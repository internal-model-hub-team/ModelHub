import hashlib
import json
import random
import re
import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from ..config import get_settings
from ..database import get_db
from ..models import RepoType, Repository, User, Visibility
from ..schemas import AssistantChatRequest, AssistantChatResponse
from ..security import get_optional_user
from .repositories import serialize

router = APIRouter(prefix="/assistant", tags=["assistant"])

SEARCH_WORDS = ("找", "搜索", "查找", "查询", "推荐", "有没有", "现有")
GENERATE_WORDS = ("生成", "合成", "创建", "构造", "造一份")
STOP_WORDS = (
    "帮我",
    "请",
    "寻找",
    "查找",
    "搜索",
    "查询",
    "推荐",
    "有没有",
    "一个",
    "一些",
    "公开",
    "相关",
    "关于",
    "适合",
    "用于",
    "数据集",
    "数据",
    "的",
)


def _suggested_slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9_.-]+", "-", value.lower()).strip("-.")[:70]
    if slug:
        return slug
    digest = hashlib.sha256(value.encode()).hexdigest()[:8]
    return f"synthetic-{digest}"


def _search_terms(message: str) -> list[str]:
    cleaned = message.lower()
    for word in STOP_WORDS:
        cleaned = cleaned.replace(word, " ")
    terms = re.findall(r"[a-z0-9_.-]+|[\u4e00-\u9fff]{2,}", cleaned)
    return list(dict.fromkeys(term for term in terms if len(term) >= 2))[:6]


def _search_datasets(
    db: Session,
    user: User | None,
    message: str,
) -> list[Repository]:
    permission_filter = or_(
        Repository.visibility == Visibility.public,
        Repository.owner_id == (user.id if user else -1),
    )
    statement = (
        select(Repository)
        .join(Repository.owner)
        .options(joinedload(Repository.owner))
        .where(Repository.repo_type == RepoType.dataset, permission_filter)
    )
    terms = _search_terms(message)
    if terms:
        matches = []
        for term in terms:
            needle = f"%{term}%"
            matches.extend(
                [
                    Repository.name.ilike(needle),
                    Repository.description.ilike(needle),
                    Repository.tags.ilike(needle),
                    Repository.slug.ilike(needle),
                ]
            )
        statement = statement.where(or_(*matches))
    return list(
        db.scalars(statement.order_by(Repository.updated_at.desc()).limit(6)).all()
    )


def _local_rows(message: str, row_count: int) -> tuple[list[str], list[dict]]:
    prompt = message.lower()
    seed = int(hashlib.sha256(message.encode()).hexdigest()[:8], 16)
    rng = random.Random(seed)
    if any(word in prompt for word in ("客服", "问答", "对话", "instruction")):
        columns = ["id", "question", "answer", "category", "quality_score"]
        categories = ["账号", "订单", "退款", "产品", "技术支持"]
        rows = [
            {
                "id": index + 1,
                "question": f"示例问题 {index + 1}：如何处理{categories[index % len(categories)]}问题？",
                "answer": f"示例回答 {index + 1}：请先确认信息，再按照{categories[index % len(categories)]}流程处理。",
                "category": categories[index % len(categories)],
                "quality_score": round(rng.uniform(0.82, 0.99), 2),
            }
            for index in range(row_count)
        ]
    elif any(word in prompt for word in ("员工", "招聘", "人事", "人才")):
        columns = ["id", "department", "role", "years_experience", "city"]
        departments = ["研发", "产品", "运营", "销售"]
        cities = ["北京", "上海", "深圳", "杭州"]
        rows = [
            {
                "id": index + 1,
                "department": departments[index % len(departments)],
                "role": f"岗位-{index + 1}",
                "years_experience": rng.randint(1, 10),
                "city": cities[index % len(cities)],
            }
            for index in range(row_count)
        ]
    elif any(word in prompt for word in ("商品", "电商", "产品", "销售")):
        columns = ["product_id", "product_name", "category", "price", "sales"]
        categories = ["电子产品", "办公用品", "家居", "图书"]
        rows = [
            {
                "product_id": f"P{index + 1:04d}",
                "product_name": f"示例商品 {index + 1}",
                "category": categories[index % len(categories)],
                "price": round(rng.uniform(20, 1200), 2),
                "sales": rng.randint(10, 1000),
            }
            for index in range(row_count)
        ]
    else:
        columns = ["id", "name", "category", "value", "description"]
        rows = [
            {
                "id": index + 1,
                "name": f"样本 {index + 1}",
                "category": f"类别 {(index % 3) + 1}",
                "value": round(rng.uniform(0, 100), 2),
                "description": f"根据“{message[:30]}”生成的结构化示例记录。",
            }
            for index in range(row_count)
        ]
    return columns, rows


def _normalize_llm_result(content: str, message: str, row_count: int) -> tuple:
    start = content.find("{")
    end = content.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("LLM response is not JSON")
    payload = json.loads(content[start : end + 1])
    rows = payload.get("rows")
    if not isinstance(rows, list) or not rows:
        raise ValueError("LLM response has no rows")
    clean_rows: list[dict[str, str | int | float | bool | None]] = []
    for item in rows[:row_count]:
        if not isinstance(item, dict):
            continue
        clean_rows.append(
            {
                str(key)[:80]: value
                if isinstance(value, (str, int, float, bool)) or value is None
                else json.dumps(value, ensure_ascii=False)
                for key, value in list(item.items())[:20]
            }
        )
    if not clean_rows:
        raise ValueError("LLM response rows are invalid")
    columns = payload.get("columns")
    if not isinstance(columns, list) or not columns:
        columns = list(clean_rows[0])
    columns = [str(column)[:80] for column in columns[:20]]
    name = str(payload.get("name") or f"{message[:24]}合成数据集")[:100]
    answer = str(payload.get("message") or "已生成结构化数据预览。")[:1000]
    return columns, clean_rows, name, answer


def _generate_with_llm(request: AssistantChatRequest) -> tuple | None:
    settings = get_settings()
    if not settings.llm_base_url or not settings.llm_model:
        return None
    endpoint = settings.llm_base_url.rstrip("/")
    if not endpoint.endswith("/chat/completions"):
        endpoint += "/chat/completions"
    headers = {"Content-Type": "application/json"}
    if settings.llm_api_key:
        headers["Authorization"] = f"Bearer {settings.llm_api_key}"
    system_prompt = (
        "你是实验室 Model Hub 的结构化数据助手。根据用户要求生成少量演示数据。"
        "只返回 JSON 对象，字段必须包含 message、name、columns、rows；"
        "rows 是对象数组，行数不要超过用户要求。不要返回 Markdown。"
    )
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(item.model_dump() for item in request.history[-8:])
    messages.append(
        {
            "role": "user",
            "content": f"{request.message}\n生成 {request.row_count} 行结构化数据。",
        }
    )
    try:
        with httpx.Client(timeout=90, trust_env=False) as client:
            response = client.post(
                endpoint,
                headers=headers,
                json={
                    "model": settings.llm_model,
                    "messages": messages,
                    "temperature": 0.4,
                },
            )
            response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        return _normalize_llm_result(content, request.message, request.row_count)
    except (httpx.HTTPError, KeyError, TypeError, ValueError, json.JSONDecodeError):
        return None


@router.post("/chat", response_model=AssistantChatResponse)
def chat(
    request: AssistantChatRequest,
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    message = request.message.strip()
    action = request.mode
    if action == "auto":
        if any(word in message for word in GENERATE_WORDS):
            action = "generate"
        elif any(word in message for word in SEARCH_WORDS):
            action = "search"
        else:
            action = "answer"

    if action == "search":
        repositories = _search_datasets(db, user, message)
        answer = (
            f"找到 {len(repositories)} 个匹配的数据集。"
            if repositories
            else "没有找到匹配的数据集，可以换个关键词，或者让我生成一份。"
        )
        return AssistantChatResponse(
            action="search",
            message=answer,
            repositories=[serialize(repository) for repository in repositories],
        )

    if action == "generate":
        llm_result = _generate_with_llm(request)
        if llm_result is not None:
            columns, rows, name, answer = llm_result
            generator = "llm"
        else:
            columns, rows = _local_rows(message, request.row_count)
            name = f"{message[:24]}合成数据集"
            answer = (
                "已生成结构化数据预览。当前未连接外部大模型或模型暂时不可用，"
                "所以使用本地模板生成。"
            )
            generator = "local"
        return AssistantChatResponse(
            action="generate",
            message=answer,
            columns=columns,
            rows=rows,
            suggested_name=name,
            suggested_slug=_suggested_slug(name),
            generator=generator,
        )

    return AssistantChatResponse(
        action="answer",
        message="请选择“查找数据集”或“生成数据集”，再描述需要的数据。",
    )

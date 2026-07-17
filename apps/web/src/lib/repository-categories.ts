import type { RepoType, RepositoryCategory } from "@/lib/types";

export const categoryLabels: Record<RepositoryCategory, string> = {
  "model-upload": "上传模型",
  "model-generator": "结构化数据生成模型",
  "dataset-upload": "上传数据集",
  "dataset-synthetic": "模型合成数据集",
};

export function defaultCategory(repoType: RepoType): RepositoryCategory {
  return repoType === "model" ? "model-upload" : "dataset-upload";
}

export function categoryOptions(repoType: RepoType) {
  return repoType === "model"
    ? ([
        { value: "model-upload", label: "上传模型" },
        { value: "model-generator", label: "结构化数据生成模型" },
      ] as const)
    : ([
        { value: "dataset-upload", label: "上传数据集" },
        { value: "dataset-synthetic", label: "模型合成数据集" },
      ] as const);
}

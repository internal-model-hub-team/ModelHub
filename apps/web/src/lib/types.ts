export type RepoType = "model" | "dataset";
export type Visibility = "public" | "private";

export type User = {
  id: number;
  username: string;
  email: string;
  display_name: string;
  bio: string;
  created_at: string;
};

export type AuthToken = {
  access_token: string;
  token_type: string;
};

export type OwnerSummary = {
  username: string;
  display_name: string;
};

export type Repository = {
  id: number;
  name: string;
  slug: string;
  repo_type: RepoType;
  visibility: Visibility;
  description: string;
  tags: string[];
  license: string;
  readme: string;
  clone_url: string;
  download_count: number;
  owner: OwnerSummary;
  created_at: string;
  updated_at: string;
};

export type PaginatedRepositories = {
  items: Repository[];
  total: number;
  page: number;
  page_size: number;
};

export type RepositoryCreate = {
  name: string;
  slug: string;
  repo_type: RepoType;
  visibility: Visibility;
  description: string;
  tags: string[];
  license: string;
  readme: string;
};

export type RepositoryFile = {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink" | "submodule";
  size: number;
  sha: string;
  is_lfs: boolean;
};

export type RepositoryFiles = {
  path: string;
  items: RepositoryFile[];
  total: number;
};

export type ApiTokenSummary = {
  id: number;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
};

export type ApiTokenCreated = {
  id: number;
  name: string;
  token: string;
  prefix: string;
  created_at: string;
};

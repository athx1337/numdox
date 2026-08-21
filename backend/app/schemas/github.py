from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class GitHubCodeFinding(BaseModel):
    repository: str
    owner: str
    file_path: str
    html_url: str
    matched_text: str = Field(default="", description="Snippet or context of phone number appearance")
    score: float = 0.0

class GitHubUserFinding(BaseModel):
    username: str
    name: Optional[str] = None
    profile_url: str
    bio: Optional[str] = None
    email: Optional[str] = None
    blog_domain: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    public_repos: int = 0
    pivoted_emails: List[str] = Field(default_factory=list)
    pivoted_domains: List[str] = Field(default_factory=list)

class GitHubOSINTResult(BaseModel):
    target_phone: str
    total_code_matches: int = 0
    total_user_matches: int = 0
    code_findings: List[GitHubCodeFinding] = Field(default_factory=list)
    user_findings: List[GitHubUserFinding] = Field(default_factory=list)
    pivoted_emails: List[str] = Field(default_factory=list)
    pivoted_domains: List[str] = Field(default_factory=list)
    pivoted_usernames: List[str] = Field(default_factory=list)
    search_queries_used: List[str] = Field(default_factory=list)
    rate_limited: bool = False
    notes: List[str] = Field(default_factory=list)

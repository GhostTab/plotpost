class AppError(Exception):
    def __init__(self, status_code: int, detail: str, code: str) -> None:
        self.status_code = status_code
        self.detail = detail
        self.code = code
        super().__init__(detail)


class UnauthorizedError(AppError):
    def __init__(self, detail: str = "Authentication required", code: str = "UNAUTHORIZED") -> None:
        super().__init__(401, detail, code)


class ForbiddenError(AppError):
    def __init__(self, detail: str, code: str = "FORBIDDEN") -> None:
        super().__init__(403, detail, code)


class NotFoundError(AppError):
    def __init__(self, detail: str, code: str = "NOT_FOUND") -> None:
        super().__init__(404, detail, code)


class ConflictError(AppError):
    def __init__(self, detail: str, code: str = "CONFLICT") -> None:
        super().__init__(409, detail, code)


class UpstreamError(AppError):
    def __init__(
        self,
        detail: str = "Upstream service unavailable",
        code: str = "UPSTREAM_ERROR",
        status_code: int = 502,
    ) -> None:
        super().__init__(status_code, detail, code)

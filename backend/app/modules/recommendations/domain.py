from app.core.constants import RecommendationStatus
from app.config import get_settings


def calculate_recommendation_result(rating: float | None) -> RecommendationStatus:
    """Map a recipient rating to recommendation status.

    Threshold is read from settings once; do not hard-code elsewhere.
    """
    if rating is None:
        return RecommendationStatus.PENDING

    threshold = get_settings().success_threshold
    if rating >= threshold:
        return RecommendationStatus.SUCCESS
    return RecommendationStatus.UNSUCCESSFUL

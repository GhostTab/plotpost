from enum import StrEnum


class RecommendationStatus(StrEnum):
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    UNSUCCESSFUL = "UNSUCCESSFUL"


class NotificationType(StrEnum):
    RECOMMENDATION_RECEIVED = "recommendation_received"
    RECOMMENDATION_OUTCOME = "recommendation_outcome"

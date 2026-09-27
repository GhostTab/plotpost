from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.notifications.models import Notification
from app.modules.recommendations.service import NotificationRepository
from app.modules.users.models import User


class NotificationService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.notifications = NotificationRepository(db)

    def list(self, user: User, *, limit: int, offset: int) -> list[Notification]:
        return self.notifications.list_for_user(user.id, limit=limit, offset=offset)

    def mark_read(self, user: User, notification_id: UUID) -> Notification:
        row = self.notifications.get_owned(notification_id, user.id)
        if row.read_at is None:
            row.read_at = datetime.now(timezone.utc)
            self.db.commit()
            self.db.refresh(row)
        return row

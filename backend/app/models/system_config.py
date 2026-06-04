from sqlalchemy import Column, String, Text, TIMESTAMP, func
from app.database import Base


class SystemConfig(Base):
    __tablename__ = "system_config"

    config_key = Column(String(100), primary_key=True)
    config_value = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

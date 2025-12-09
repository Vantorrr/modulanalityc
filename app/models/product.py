from sqlalchemy import Column, Integer, String, Float, Text
from app.core.database import Base

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(String, index=True, nullable=True) 
    
    name = Column(String, index=True)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=True)
    
    composition = Column(Text, nullable=True)
    composition_table = Column(Text, nullable=True)
    
    quantity = Column(Integer, default=0)
    sale_count = Column(Integer, default=0)
    filter_stocks = Column(String, nullable=True)
    
    value = Column(String, nullable=True)

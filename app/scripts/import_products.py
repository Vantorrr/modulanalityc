import asyncio
import csv
import sys
import os

# Add project root to path
sys.path.append(os.getcwd())

from app.core.database import async_session_maker
from app.models.product import Product
from sqlalchemy import select, delete

async def import_products():
    print("Starting product import...")
    
    csv_file = 'catalog_test_utf8.csv'
    if not os.path.exists(csv_file):
        print(f"File {csv_file} not found!")
        return

    async with async_session_maker() as session:
        # Optional: Clear existing products
        # await session.execute(delete(Product))
        # await session.commit()
        
        batch_size = 1000
        batch = []
        count = 0
        
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f, delimiter=';')
            
            for row in reader:
                try:
                    product = Product(
                        external_id=row.get('id'),
                        name=row.get('name'),
                        description=row.get('description'),
                        price=float(row.get('price')) if row.get('price') and row.get('price').strip() else 0.0,
                        composition=row.get('composition'),
                        composition_table=row.get('composition_table'),
                        quantity=int(row.get('quantity')) if row.get('quantity') and row.get('quantity').strip() else 0,
                        sale_count=int(row.get('sale_count')) if row.get('sale_count') and row.get('sale_count').strip() else 0,
                        filter_stocks=row.get('filter_stocks'),
                        value=row.get('value')
                    )
                    batch.append(product)
                    
                    if len(batch) >= batch_size:
                        session.add_all(batch)
                        await session.commit()
                        count += len(batch)
                        print(f"Imported {count} products...")
                        batch = []
                        
                except Exception as e:
                    print(f"Error processing row {row.get('id')}: {e}")
                    continue
            
            if batch:
                session.add_all(batch)
                await session.commit()
                count += len(batch)
                
        print(f"Finished! Total imported: {count}")

if __name__ == "__main__":
    asyncio.run(import_products())


"""
OCR Service for extracting text from medical documents.
Supports PDF and image files (JPG, PNG).
"""

import io
import logging
from pathlib import Path
from typing import List, Optional, Tuple

from PIL import Image
import pytesseract

from app.core.config import settings

logger = logging.getLogger(__name__)


class OCRService:
    """
    Service for optical character recognition of medical documents.
    Uses Tesseract OCR with Russian language support.
    """
    
    def __init__(self):
        """Initialize OCR service."""
        if settings.tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd
        
        # Tesseract configuration for better medical document recognition
        self.tesseract_config = (
            "--oem 3 "  # Use LSTM OCR Engine
            "--psm 6 "  # Assume uniform block of text
            "-l rus+eng"  # Russian + English languages
        )
    
    async def extract_text_from_image(
        self,
        image_path: str,
    ) -> Tuple[str, float]:
        """
        Extract text from an image file.
        
        Args:
            image_path: Path to the image file
            
        Returns:
            Tuple of (extracted_text, confidence_score)
        """
        try:
            image = Image.open(image_path)
            
            # Preprocess image for better OCR
            image = self._preprocess_image(image)
            
            # Extract text with confidence data
            data = pytesseract.image_to_data(
                image,
                config=self.tesseract_config,
                output_type=pytesseract.Output.DICT,
            )
            
            # Calculate average confidence
            confidences = [
                int(conf) for conf in data["conf"] 
                if conf != "-1" and str(conf).isdigit()
            ]
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0
            
            # Get full text
            text = pytesseract.image_to_string(
                image,
                config=self.tesseract_config,
            )
            
            logger.info(
                f"OCR completed for {image_path}, "
                f"confidence: {avg_confidence:.1f}%, "
                f"text length: {len(text)}"
            )
            
            return text.strip(), avg_confidence / 100
            
        except Exception as e:
            logger.error(f"OCR failed for {image_path}: {e}")
            raise OCRError(f"Ошибка распознавания изображения: {e}")
    
    async def extract_text_from_pdf(
        self,
        pdf_path: str,
    ) -> List[Tuple[str, int, float]]:
        """
        Extract text from a PDF file.
        Converts each page to image and runs OCR.
        
        Args:
            pdf_path: Path to the PDF file
            
        Returns:
            List of tuples (text, page_number, confidence)
        """
        try:
            from pdf2image import convert_from_path
            
            # Convert PDF pages to images
            images = convert_from_path(
                pdf_path,
                dpi=300,  # High DPI for better OCR
                fmt="png",
            )
            
            results = []
            for page_num, image in enumerate(images, start=1):
                # Preprocess
                image = self._preprocess_image(image)
                
                # OCR
                text = pytesseract.image_to_string(
                    image,
                    config=self.tesseract_config,
                )
                
                # Get confidence
                data = pytesseract.image_to_data(
                    image,
                    config=self.tesseract_config,
                    output_type=pytesseract.Output.DICT,
                )
                confidences = [
                    int(conf) for conf in data["conf"]
                    if conf != "-1" and str(conf).isdigit()
                ]
                avg_confidence = sum(confidences) / len(confidences) if confidences else 0
                
                results.append((text.strip(), page_num, avg_confidence / 100))
                
                logger.info(
                    f"OCR completed for PDF page {page_num}/{len(images)}, "
                    f"confidence: {avg_confidence:.1f}%"
                )
            
            return results
            
        except ImportError:
            logger.error("pdf2image not installed")
            raise OCRError("PDF обработка недоступна. Установите pdf2image и poppler.")
        except Exception as e:
            logger.error(f"PDF OCR failed for {pdf_path}: {e}")
            raise OCRError(f"Ошибка распознавания PDF: {e}")
    
    async def extract_text_from_bytes(
        self,
        file_bytes: bytes,
        content_type: str,
    ) -> Tuple[str, float]:
        """
        Extract text from file bytes.
        
        Args:
            file_bytes: Raw file content
            content_type: MIME type of the file
            
        Returns:
            Tuple of (extracted_text, confidence_score)
        """
        if content_type == "application/pdf":
            # Save to temp file for pdf2image
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp.write(file_bytes)
                tmp_path = tmp.name
            
            try:
                results = await self.extract_text_from_pdf(tmp_path)
                # Combine all pages
                combined_text = "\n\n--- Страница ---\n\n".join(
                    text for text, _, _ in results
                )
                avg_confidence = sum(conf for _, _, conf in results) / len(results) if results else 0
                return combined_text, avg_confidence
            finally:
                Path(tmp_path).unlink(missing_ok=True)
        
        elif content_type in ("image/jpeg", "image/jpg", "image/png"):
            # Load image from bytes
            image = Image.open(io.BytesIO(file_bytes))
            image = self._preprocess_image(image)
            
            text = pytesseract.image_to_string(
                image,
                config=self.tesseract_config,
            )
            
            # Get confidence
            data = pytesseract.image_to_data(
                image,
                config=self.tesseract_config,
                output_type=pytesseract.Output.DICT,
            )
            confidences = [
                int(conf) for conf in data["conf"]
                if conf != "-1" and str(conf).isdigit()
            ]
            avg_confidence = sum(confidences) / len(confidences) / 100 if confidences else 0
            
            return text.strip(), avg_confidence
        
        else:
            raise OCRError(f"Неподдерживаемый тип файла: {content_type}")
    
    def _preprocess_image(self, image: Image.Image) -> Image.Image:
        """
        Preprocess image for better OCR results.
        
        - Convert to grayscale
        - Increase contrast
        - Remove noise
        - Scale if too small
        """
        # Convert to RGB if necessary (for PNG with transparency)
        if image.mode == "RGBA":
            background = Image.new("RGB", image.size, (255, 255, 255))
            background.paste(image, mask=image.split()[3])
            image = background
        elif image.mode != "RGB":
            image = image.convert("RGB")
        
        # Convert to grayscale
        image = image.convert("L")
        
        # Scale up small images
        min_dimension = 1000
        if min(image.size) < min_dimension:
            scale = min_dimension / min(image.size)
            new_size = (int(image.width * scale), int(image.height * scale))
            image = image.resize(new_size, Image.Resampling.LANCZOS)
        
        # Increase contrast using simple thresholding
        # This helps with faded or low-contrast documents
        from PIL import ImageEnhance
        enhancer = ImageEnhance.Contrast(image.convert("RGB"))
        image = enhancer.enhance(1.5)
        image = image.convert("L")
        
        return image


class OCRError(Exception):
    """Custom exception for OCR errors."""
    pass



import streamlit as st
import cv2
import numpy as np
from PIL import Image
import io

def apply_clahe(image, clip_limit=2.0, tile_grid_size=8):
    """
    Apply Contrast Limited Adaptive Histogram Equalization (CLAHE)
    """
    # Convert PIL image to OpenCV format
    cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    
    # Convert to LAB color space
    lab_image = cv2.cvtColor(cv_image, cv2.COLOR_BGR2LAB)
    
    # Apply CLAHE to L channel
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(tile_grid_size, tile_grid_size))
    lab_image[:, :, 0] = clahe.apply(lab_image[:, :, 0])
    
    # Convert back to BGR and then to RGB
    corrected_bgr = cv2.cvtColor(lab_image, cv2.COLOR_LAB2BGR)
    corrected_rgb = cv2.cvtColor(corrected_bgr, cv2.COLOR_BGR2RGB)
    
    return Image.fromarray(corrected_rgb)

def calculate_metrics(image):
    """Calculate brightness and contrast metrics"""
    image_array = np.array(image)
    
    # Calculate mean brightness
    brightness = np.mean(image_array)
    
    # Calculate standard deviation (contrast measure)
    contrast = np.std(image_array)
    
    return brightness, contrast

def main():
    st.set_page_config(
        page_title="CLAHE Image Enhancement",
        page_icon="📸",
        layout="wide"
    )
    
    st.title("📸 CLAHE Image Enhancement")
    st.markdown("Upload an image and apply Contrast Limited Adaptive Histogram Equalization (CLAHE)")
    
    # Sidebar controls
    st.sidebar.markdown("### 🎛️ CLAHE Parameters")
    clip_limit = st.sidebar.slider("Clip Limit", 1.0, 5.0, 2.0, 0.1)
    tile_grid_size = st.sidebar.slider("Tile Grid Size", 4, 16, 8, 2)
    
    # File uploader
    uploaded_file = st.file_uploader(
        "Choose an image file",
        type=['jpg', 'jpeg', 'png'],
        help="Supported formats: JPEG, PNG"
    )
    
    if uploaded_file is not None:
        try:
            # Load original image
            original_image = Image.open(uploaded_file)
            
            # Ensure image is in RGB mode
            if original_image.mode != 'RGB':
                original_image = original_image.convert('RGB')
            
            st.success("✅ Image uploaded successfully!")
            
            # Display image info
            st.sidebar.markdown("### 📊 Image Information")
            st.sidebar.markdown(f"**Filename:** {uploaded_file.name}")
            st.sidebar.markdown(f"**Size:** {original_image.size[0]} × {original_image.size[1]} pixels")
            st.sidebar.markdown(f"**Mode:** {original_image.mode}")
            
            # Calculate original metrics
            orig_brightness, orig_contrast = calculate_metrics(original_image)
            
            # Process image with CLAHE
            with st.spinner("🔄 Applying CLAHE..."):
                enhanced_image = apply_clahe(original_image, clip_limit, tile_grid_size)
            
            # Calculate enhanced metrics
            enh_brightness, enh_contrast = calculate_metrics(enhanced_image)
            
            # Display before/after comparison
            st.markdown("## 🔍 Before & After Comparison")
            
            col1, col2 = st.columns(2)
            
            with col1:
                st.markdown("### Original Image")
                st.image(original_image, use_container_width=True)
                
                # Original metrics
                st.markdown("**Original Metrics:**")
                st.write(f"Brightness: {orig_brightness:.1f}")
                st.write(f"Contrast: {orig_contrast:.1f}")
            
            with col2:
                st.markdown("### Enhanced Image (CLAHE)")
                st.image(enhanced_image, use_container_width=True)
                
                # Enhanced metrics
                st.markdown("**Enhanced Metrics:**")
                st.write(f"Brightness: {enh_brightness:.1f}")
                st.write(f"Contrast: {enh_contrast:.1f}")
                
                # Delta metrics
                brightness_delta = enh_brightness - orig_brightness
                contrast_delta = enh_contrast - orig_contrast
                st.write(f"Δ Brightness: {brightness_delta:+.1f}")
                st.write(f"Δ Contrast: {contrast_delta:+.1f}")
            
            # Download section
            st.markdown("## 💾 Download Enhanced Image")
            
            # Generate filename for processed image
            base_filename = uploaded_file.name.rsplit('.', 1)[0]
            processed_filename = f"{base_filename}_clahe_enhanced.png"
            
            # Create download button
            img_buffer = io.BytesIO()
            enhanced_image.save(img_buffer, format='PNG')
            img_buffer.seek(0)
            
            st.download_button(
                label="📥 Download Enhanced Image",
                data=img_buffer.getvalue(),
                file_name=processed_filename,
                mime="image/png"
            )
            
            # Technical details
            st.markdown("## 🔬 Technical Details")
            col1, col2, col3 = st.columns(3)
            
            with col1:
                st.metric("Clip Limit", f"{clip_limit}")
            
            with col2:
                st.metric("Tile Grid Size", f"{tile_grid_size}x{tile_grid_size}")
            
            with col3:
                st.metric("Color Space", "LAB")
            
            st.markdown("""
            **CLAHE Algorithm Details:**
            - **Color Space**: LAB (L*a*b*)
            - **Processing Channel**: L (Lightness)
            - **Tile-based Processing**: Image divided into tiles for local adaptation
            - **Histogram Clipping**: Prevents over-amplification of noise
            - **Contrast Enhancement**: Adaptive histogram equalization per tile
            """)
            
        except Exception as e:
            st.error(f"❌ Error processing image: {str(e)}")
            st.markdown("Please ensure you've uploaded a valid image file (JPEG or PNG).")
    
    else:
        # Instructions when no file is uploaded
        st.info("📤 Upload an image file above to apply CLAHE enhancement.")
        
        st.markdown("""
        ### What is CLAHE?
        
        **Contrast Limited Adaptive Histogram Equalization (CLAHE)** is an advanced image enhancement technique that:
        
        - **Improves local contrast** by processing image tiles independently
        - **Prevents noise amplification** through histogram clipping
        - **Preserves color information** by working in LAB color space
        - **Adapts to image content** with configurable parameters
        
        ### Parameters:
        - **Clip Limit**: Controls contrast enhancement (higher = more contrast)
        - **Tile Grid Size**: Size of processing tiles (smaller = more local adaptation)
        """)

if __name__ == "__main__":
    main()
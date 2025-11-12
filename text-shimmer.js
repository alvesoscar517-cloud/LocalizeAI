// Text Shimmer Component for AI Loading States
// Inspired by modern UI libraries like shadcn/ui

class TextShimmer {
  constructor(element, options = {}) {
    this.element = element;
    this.duration = options.duration || 2; // Moderate speed for visibility
    this.originalText = element.textContent;
    this.isActive = false;
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;
    
    // Wrap text in shimmer container - using background-clip technique like shadcn/ui
    const shimmerHTML = `
      <span class="text-shimmer-wrapper" style="
        display: inline-block;
        background: linear-gradient(
          110deg,
          currentColor 0%,
          currentColor 40%,
          #a78bfa 45%,
          #c4b5fd 50%,
          #a78bfa 55%,
          currentColor 60%,
          currentColor 100%
        );
        background-size: 200% 100%;
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        animation: shimmer ${this.duration}s ease-in-out infinite;
      ">${this.element.textContent}</span>
    `;
    
    this.element.innerHTML = shimmerHTML;
    
    // Add keyframes if not already added
    if (!document.getElementById('text-shimmer-keyframes')) {
      const style = document.createElement('style');
      style.id = 'text-shimmer-keyframes';
      style.textContent = `
        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  stop() {
    if (!this.isActive) return;
    this.isActive = false;
    
    // Restore original text
    this.element.textContent = this.originalText;
  }

  updateText(newText) {
    this.originalText = newText;
    if (this.isActive) {
      const wrapper = this.element.querySelector('.text-shimmer-wrapper');
      if (wrapper) {
        wrapper.textContent = newText;
      }
    } else {
      this.element.textContent = newText;
    }
  }
}

// Helper function to create shimmer effect on button
function createButtonShimmer(buttonId) {
  const button = document.getElementById(buttonId);
  if (!button) return null;
  
  const textElement = button.querySelector('span:not(.badge)');
  if (!textElement) return null;
  
  const shimmer = new TextShimmer(textElement, { duration: 2 }); // Moderate speed
  
  return {
    start: () => {
      button.disabled = true;
      button.style.opacity = '0.8';
      button.style.cursor = 'not-allowed';
      // Don't change text, just apply shimmer to original text
      shimmer.start();
    },
    stop: () => {
      shimmer.stop();
      button.disabled = false;
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
    }
  };
}

// Export for use in content.js
window.TextShimmer = TextShimmer;
window.createButtonShimmer = createButtonShimmer;

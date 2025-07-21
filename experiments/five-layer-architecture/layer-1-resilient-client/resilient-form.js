// Resilient form handling with progressive enhancement
export class ResilientForm {
  constructor(form) {
    this.form = form;
    this.isEnhanced = false;
    this.initializeBaseline();
    this.enhanceIfCapable();
  }

  initializeBaseline() {
    // Ensure form works without JavaScript
    this.form.setAttribute('method', 'POST');
    this.form.setAttribute('action', this.form.dataset.fallbackUrl);
  }

  enhanceIfCapable() {
    if (!window.fetch || !window.FormData) {
      return; // Graceful degradation
    }

    this.isEnhanced = true;
    this.form.addEventListener('submit', this.handleEnhancedSubmit.bind(this));
  }

  async handleEnhancedSubmit(event) {
    event.preventDefault();

    const formData = new FormData(this.form);
    const submitButton = this.form.querySelector('[type="submit"]');

    try {
      // Optimistic UI updates
      this.setLoadingState(submitButton, true);

      const response = await fetch(this.form.action, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      this.handleSuccess(result);
    } catch (error) {
      this.handleError(error);

      // Fallback to standard form submission
      if (error.name === 'AbortError' || error.name === 'TypeError') {
        this.fallbackToStandardSubmission();
      }
    } finally {
      this.setLoadingState(submitButton, false);
    }
  }

  fallbackToStandardSubmission() {
    // Remove enhanced behavior and submit normally
    this.form.removeEventListener('submit', this.handleEnhancedSubmit);
    this.form.submit();
  }

  setLoadingState(button, isLoading) {
    button.disabled = isLoading;
    button.textContent = isLoading ? 'Processing...' : 'Submit';
  }

  handleError(error) {
    // Show user-friendly error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = 'Something went wrong. Please try again.';

    this.form.insertBefore(errorDiv, this.form.firstChild);

    // Log detailed error for developers
    console.error('Form submission error:', error);
  }
}

// Initialize all forms with resilient enhancement
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('form[data-enhance]').forEach((form) => {
    new ResilientForm(form);
  });
});

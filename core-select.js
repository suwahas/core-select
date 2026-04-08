/**
 * Core Select Plugin for Core JS - v2.2
 * A production-ready, accessible, and performant select box replacement.
 *
 * @version 2.2
 * @author https://github.com/suwahas
 * @requires core.js
 */
(function(J) {
  if (!J) {
    console.error('Core JS (J) is not loaded. Core Select cannot be initialized.');
    return;
  }

  // Unique ID generator for ARIA attributes
  let instanceCounter = 0;

  class CoreSelect {
    constructor(element, options) {
      this.settings = { ...CoreSelect.defaults, ...options };
      this.elements = {
        $input: J(element),
        $wrapper: null,
        $dropdown: null,
        $hiddenInput: null,
      };
      this.state = {
        isOpen: false,
        results: [],
        $options: [], // Cache DOM nodes for fast keyboard nav
        highlightedIndex: -1,
        isLoading: false,
        currentAjaxTerm: '', 
        currentXhr: null, // Tracks active network request for abortion
        id: `cs-${++instanceCounter}`,
        originalValue: '',
        originalHiddenValue: ''
      };
      this.cache = new Map(); // ES6 Map prevents Prototype Pollution
      this.boundDocumentClick = this._handleDocumentClick.bind(this);

      this._init();
    }

    _init() {
      this._setupUI();
      this._bindEvents();
      
      // Store original values for native form reset synchronization
      this.state.originalValue = this.elements.$input.val();
      this.state.originalHiddenValue = this.elements.$hiddenInput ? this.elements.$hiddenInput.val() : '';
    }

    _setupUI() {
      const dropdownId = `${this.state.id}-dropdown`;
      
      this.elements.$wrapper = J('<div class="core-select-wrapper"></div>');
      this.elements.$dropdown = J(`<div class="core-select-dropdown" id="${dropdownId}" role="listbox"></div>`).hide();
      
      const originalName = this.elements.$input.attr('name');
      if (originalName) {
        this.elements.$hiddenInput = J(`<input type="hidden" name="${originalName}" />`);
        this.elements.$input.attr('name', `${originalName}-display`);
        this.elements.$wrapper.append(this.elements.$hiddenInput);
      }

      // ARIA & Accessibility Setup
      this.elements.$input.attr({
        'placeholder': this.settings.placeholder,
        'autocomplete': 'off',
        'role': 'combobox',
        'aria-expanded': 'false',
        'aria-controls': dropdownId,
        'aria-autocomplete': 'list'
      });

      // Replace .wrap() with pure core.js DOM manipulation
      this.elements.$input.before(this.elements.$wrapper);
      this.elements.$wrapper.append(this.elements.$input);
      this.elements.$wrapper.append(this.elements.$dropdown);
    }

    _bindEvents() {
      // Use exact namespaces to protect developer events
      this.elements.$input.on('focus.coreSelect', () => this._handleFocus());
      this.elements.$input.on('blur.coreSelect', () => this._handleBlur());
      this.elements.$input.on('input.coreSelect', J.debounce((e) => this._handleInput(e), 250));
      this.elements.$input.on('keydown.coreSelect', (e) => this._handleKeyDown(e));
      
      // Delegate click events specifically for options
      this.elements.$dropdown.on('click.coreSelect', '.core-select-option', (e) => this._handleSelection(e));
      
      // Sync with native HTML form reset lifecycle
      const form = this.elements.$input[0].form;
      if (form) {
        J(form).on(`reset.coreSelect.${this.state.id}`, () => {
          // setTimeout ensures native reset finishes evaluating before we sync UI
          setTimeout(() => this._resetToDefault(), 0);
        });
      }
    }

    _handleBlur() {
      // Delay closing to allow option click events to complete first
      setTimeout(() => {
        // If focus has moved outside the entire wrapper (e.g., user pressed Tab), close it
        if (this.state.isOpen && !this.elements.$wrapper[0].contains(document.activeElement)) {
          this.close();
        }
      }, 150);
    }

    _handleDocumentClick(e) {
      // O(1) Native DOM check - bypasses core.js instantiation for global clicks
      if (this.elements.$wrapper[0] && !this.elements.$wrapper[0].contains(e.target)) {
        this.close();
      }
    }

    _handleFocus() {
        // Fix: Always render local data on initial focus, even if a default value exists
        if (this.settings.data && this.state.results.length === 0) {
            this._renderDropdown(this.settings.data);
        } else if (this.state.results.length > 0) {
            this.open();
        }
    }

    _handleInput() {
      const term = this.elements.$input.val().trim();
      if (term.length < this.settings.minimumInputLength) {
        // Proactive Fix: Abort pending AJAX if user backspaces the input to empty
        if (this.state.currentXhr) {
          this.state.currentXhr.abort();
          this.state.currentXhr = null;
        }
        this.close();
        return;
      }
      this._search(term);
    }

    _handleKeyDown(e) {
      if (!this.state.isOpen) {
        // WCAG Standard: ArrowDown opens closed comboboxes
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this._search(this.elements.$input.val().trim());
        }
        // Allow native 'Enter' to submit the form if dropdown is closed
        return;
      }
      
      switch (e.key) {
        case 'ArrowDown': 
          e.preventDefault();
          this._highlightOption(this.state.highlightedIndex + 1); 
          break;
        case 'ArrowUp': 
          e.preventDefault();
          this._highlightOption(this.state.highlightedIndex - 1); 
          break;
        case 'Home':
          e.preventDefault();
          this._highlightOption(0);
          break;
        case 'End':
          e.preventDefault();
          this._highlightOption(this.state.$options.length - 1);
          break;
        case 'PageDown':
          e.preventDefault();
          // Math.min naturally prevents wrap-around behavior for page jumps
          this._highlightOption(Math.min(this.state.$options.length - 1, this.state.highlightedIndex + 10));
          break;
        case 'PageUp':
          e.preventDefault();
          // Math.max naturally prevents wrap-around behavior for page jumps
          this._highlightOption(Math.max(0, this.state.highlightedIndex - 10));
          break;
        case 'Enter':
          e.preventDefault();
          if (this.state.highlightedIndex > -1) {
            this.select(this.state.results[this.state.highlightedIndex]);
          }
          break;
        case 'Escape': 
          e.preventDefault();
          this.close(); 
          break;
      }
    }

    _handleSelection(e) {
      // core.js uses native events, so currentTarget is the dropdown wrapper. 
      // We use e.target and .closest() to accurately capture the clicked option.
      const $option = J(e.target).closest('.core-select-option');
      const selectedData = $option.data('core-select-item');
      
      if (selectedData) {
        this.select(selectedData);
      }
    }

    _search(term) {
      if (this.settings.ajax) {
        if (this.cache.has(term)) {
          this._renderDropdown(this.cache.get(term));
        } else {
          this._fetchAjaxData(term);
        }
      } else if (this.settings.data) {
        this._filterLocalData(term);
      }
    }

    _fetchAjaxData(term) {
      this.state.currentAjaxTerm = term; // Track latest request
      this.state.isLoading = true;
      this._renderMessage('Loading...');

      // True Network Abortion: Stop previous request to prevent waterfall
      if (this.state.currentXhr) {
        this.state.currentXhr.abort();
        this.state.currentXhr = null;
      }

      // Allow dynamic data mapping via function, fallback to default searchParam
      const ajaxData = typeof this.settings.ajax.data === 'function'
        ? this.settings.ajax.data(term)
        : { [this.settings.searchParam]: term, ...(this.settings.ajax.data || {}) };

      const originalBeforeSend = this.settings.ajax.beforeSend;

      J.ajax({
        ...this.settings.ajax,
        data: ajaxData,
        beforeSend: (xhr, settings) => {
          this.state.currentXhr = xhr;
          if (originalBeforeSend) return originalBeforeSend.call(this, xhr, settings);
        },
        success: (response) => {
          // Race Condition Fix: Ignore if user typed something else while waiting
          if (this.state.currentAjaxTerm !== term) return;
          
          const results = this.settings.ajax.processResults ? this.settings.ajax.processResults(response) : response;
          this.cache.set(term, results);
          this._renderDropdown(results);
        },
        error: (xhr, status, err) => {
           if (status === 'abort') return; // Silently ignore intentional aborts
           if (this.state.currentAjaxTerm === term) this._renderMessage(`Error: Request failed`);
        },
        complete: () => {
           if (this.state.currentAjaxTerm === term) this.state.isLoading = false;
        },
      });
    }

    _filterLocalData(term) {
      const lowerTerm = term.toLowerCase();
      const results = this.settings.data.filter(item => 
        item.text.toLowerCase().includes(lowerTerm)
      );
      this._renderDropdown(results);
    }
    
    _renderDropdown(results) {
      this.elements.$dropdown.empty();
      this.state.results = results;
      this.state.$options = []; // Reset cached options
      this.state.highlightedIndex = -1;
      this.elements.$input.removeAttr('aria-activedescendant');

      if (results.length === 0) {
        this._renderMessage('No results found');
      } else {
        const newOptions = results.map((item, index) => {
          const itemHtml = this.settings.formatResult(item);
          const optionId = `${this.state.id}-opt-${index}`;
          
          // Create node and safely append HTML
          const $option = J(`<div class="core-select-option" id="${optionId}" role="option" aria-selected="false"></div>`);
          if (this.settings.escapeMarkup) {
             $option.text(itemHtml); // Mitigates XSS
          } else {
             $option.html(itemHtml);
          }
          
          $option.data('core-select-item', item);
          this.state.$options.push($option[0]); // Cache for O(1) keyboard nav
          return $option[0];
        });
        this.elements.$dropdown.append(newOptions);
      }
      this.open();
    }
    
    _renderMessage(message) {
      this.state.$options = [];
      this.elements.$dropdown.html(`<div class="core-select-message" role="status">${message}</div>`);
      this.open();
    }

    _highlightOption(index) {
        const options = this.state.$options; // Use cached array, bypass DOM query
        if (options.length === 0) return;

        if (this.state.highlightedIndex > -1) {
            J(options[this.state.highlightedIndex]).removeClass('highlighted').attr('aria-selected', 'false');
        }

        if (index >= options.length) index = 0;
        if (index < 0) index = options.length - 1;

        const newHighlightedOption = J(options[index]);
        newHighlightedOption.addClass('highlighted').attr('aria-selected', 'true');
        
        this.elements.$input.attr('aria-activedescendant', newHighlightedOption.attr('id'));
        newHighlightedOption[0].scrollIntoView({ block: 'nearest' });
        this.state.highlightedIndex = index;
    }

    _resetToDefault() {
      this.elements.$input.val(this.state.originalValue);
      if (this.elements.$hiddenInput) this.elements.$hiddenInput.val(this.state.originalHiddenValue);
      this.elements.$input.removeAttr('aria-activedescendant');
      this.state.highlightedIndex = -1;
      this.close();
    }

    // --- Public API Methods ---
    select(item) {
      this.elements.$input.val(this.settings.formatSelection(item));
      if (this.elements.$hiddenInput) this.elements.$hiddenInput.val(item[this.settings.idParam]);
      this.close();
      this.settings.onSelect(item);
      this.elements.$input.trigger('change');
    }

    open() {
      if (this.state.isOpen) return;
      this.state.isOpen = true;
      this.elements.$dropdown.show();
      
      // --- Smart Viewport Flipping ---
      // Utilizes core.js deep-measure engine to calculate true dimensions
      const dropdownHeight = this.elements.$dropdown.outerHeight();
      const inputOffset = this.elements.$input.offset();
      const inputHeight = this.elements.$input.outerHeight();
      const scrollTop = J(window).scrollTop();
      const windowHeight = J(window).height();
      
      // Check if dropdown goes below the visible viewport AND there is enough room above it
      if (inputOffset.top + inputHeight + dropdownHeight > scrollTop + windowHeight && 
          inputOffset.top - scrollTop > dropdownHeight) {
        this.elements.$dropdown.css({
          top: 'auto',
          bottom: 'calc(100% + 4px)'
        });
      } else {
        this.elements.$dropdown.css({
          top: 'calc(100% + 4px)',
          bottom: 'auto'
        });
      }

      this.elements.$input.attr('aria-expanded', 'true');
      
      // Fix: Delay document listener binding to prevent immediate event bubbling closure
      setTimeout(() => {
        if (this.state.isOpen) {
          J(document).on(`click.coreSelect.${this.state.id}`, this.boundDocumentClick);
        }
      }, 0);
    }

    close() {
      if (!this.state.isOpen) return;
      this.state.isOpen = false;
      this.elements.$dropdown.hide();
      this.elements.$input.attr('aria-expanded', 'false');
      J(document).off(`click.coreSelect.${this.state.id}`, this.boundDocumentClick);
    }
    
    destroy() {
      // 1. Unbind specifically namespaced events (document/form events scoped to THIS instance)
      J(document).off(`.coreSelect.${this.state.id}`);
      this.elements.$input.off('.coreSelect');
      this.elements.$dropdown.off('.coreSelect');
      
      const form = this.elements.$input[0].form;
      if (form) J(form).off(`.coreSelect.${this.state.id}`);
      
      // 2. Clear WeakMap instance data using new core.js memory manager
      this.elements.$input.removeData('coreSelect');
      
      // 3. Restore original attributes
      const originalName = this.elements.$hiddenInput?.attr('name');
      if (originalName) this.elements.$input.attr('name', originalName);
      
      this.elements.$input.removeAttr('role aria-expanded aria-controls aria-autocomplete aria-activedescendant');
      
      // 4. Pure core.js unwrap logic (Move input out, delete wrapper)
      this.elements.$wrapper.before(this.elements.$input);
      this.elements.$wrapper.remove();
    }
  }

  CoreSelect.defaults = {
    placeholder: 'Select an option',
    minimumInputLength: 1,
    searchParam: 'term', // The API query parameter for the search string
    idParam: 'id',       // The data key used for the hidden input value
    data: null,
    ajax: null,
    escapeMarkup: true, // Security: Default to text() to prevent XSS
    onSelect: function(data) {},
    formatResult: function(item) { return item.text; },
    formatSelection: function(item) { return item.text; }
  };
  
  // Register the plugin using the Core JS Plugin Factory
  J.plugin('coreSelect', CoreSelect);

  if (!J.debounce) {
    J.debounce = function(func, delay) {
      let timeout;
      return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
      };
    };
  }

})(window.J);

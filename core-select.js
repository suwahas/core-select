/**
 * Core Select Plugin for Core JS - v2.1
 * A production-ready, accessible, and performant select box replacement.
 *
 * @version 2.1
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
        currentAjaxTerm: '', // Prevents AJAX race conditions
        id: `cs-${++instanceCounter}`
      };
      this.cache = new Map(); // ES6 Map prevents Prototype Pollution
      this.boundDocumentClick = this._handleDocumentClick.bind(this);

      if (this.elements.$input.data('coreSelectInstance')) return;
      this._init();
    }

    _init() {
      this._setupUI();
      this._bindEvents();
      this.elements.$input.data('coreSelectInstance', this);
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
      this.elements.$input.on('input.coreSelect', J.debounce((e) => this._handleInput(e), 250));
      this.elements.$input.on('keydown.coreSelect', (e) => this._handleKeyDown(e));
      
      // Delegate click events specifically for options
      this.elements.$dropdown.on('click.coreSelect', '.core-select-option', (e) => this._handleSelection(e));
    }

    _handleDocumentClick(e) {
      // O(1) Native DOM check - bypasses core.js instantiation for global clicks
      if (this.elements.$wrapper[0] && !this.elements.$wrapper[0].contains(e.target)) {
        this.close();
      }
    }

    _handleFocus() {
        if (this.settings.data && !this.elements.$input.val()) {
            this._renderDropdown(this.settings.data);
        } else if (this.state.results.length > 0) {
            this.open();
        }
    }

    _handleInput() {
      const term = this.elements.$input.val().trim();
      if (term.length < this.settings.minimumInputLength) {
        this.close();
        return;
      }
      this._search(term);
    }

    _handleKeyDown(e) {
      if (!this.state.isOpen) {
        // WCAG Standard: ArrowDown opens closed comboboxes
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
            e.preventDefault();
            this._search(this.elements.$input.val().trim());
        }
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

      // Allow dynamic data mapping via function, fallback to default searchParam
      const ajaxData = typeof this.settings.ajax.data === 'function'
        ? this.settings.ajax.data(term)
        : { [this.settings.searchParam]: term, ...(this.settings.ajax.data || {}) };

      J.ajax({
        ...this.settings.ajax,
        data: ajaxData,
        success: (response) => {
          // Race Condition Fix: Ignore if user typed something else while waiting
          if (this.state.currentAjaxTerm !== term) return;
          
          const results = this.settings.ajax.processResults ? this.settings.ajax.processResults(response) : response;
          this.cache.set(term, results);
          this._renderDropdown(results);
        },
        error: (err) => {
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

    // --- Public API Methods ---
    select(item) {
      this.elements.$input.val(this.settings.formatSelection(item));
      if (this.elements.$hiddenInput) this.elements.$hiddenInput.val(item.id);
      this.close();
      this.settings.onSelect(item);
      this.elements.$input.trigger('change');
    }

    open() {
      if (this.state.isOpen) return;
      this.state.isOpen = true;
      this.elements.$dropdown.show();
      this.elements.$input.attr('aria-expanded', 'true');
      J(document).on('click.coreSelect', this.boundDocumentClick);
    }

    close() {
      if (!this.state.isOpen) return;
      this.state.isOpen = false;
      this.elements.$dropdown.hide();
      this.elements.$input.attr('aria-expanded', 'false');
      J(document).off('click.coreSelect', this.boundDocumentClick);
    }
    
    destroy() {
      // 1. Unbind specifically namespaced events
      J(document).off('.coreSelect');
      this.elements.$input.off('.coreSelect');
      this.elements.$dropdown.off('.coreSelect');
      
      // 2. Clear WeakMap instance data
      this.elements.$input.data('coreSelectInstance', null); // Set to null effectively clears it
      
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
    data: null,
    ajax: null,
    escapeMarkup: true, // Security: Default to text() to prevent XSS
    onSelect: function(data) {},
    formatResult: function(item) { return item.text; },
    formatSelection: function(item) { return item.text; }
  };
  
  J.fn.coreSelect = function(optionsOrMethod, ...args) {
    return this.each(function() {
      const instance = J(this).data('coreSelectInstance');
      if (typeof optionsOrMethod === 'string' && instance) {
        instance[optionsOrMethod](...args);
      } else if (!instance) {
        new CoreSelect(this, optionsOrMethod);
      }
    });
  };

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

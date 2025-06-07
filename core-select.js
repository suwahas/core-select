/**
 * Core Select Plugin for Core JS - v2.0
 * A production-ready, accessible, and performant select box replacement.
 *
 * @version 2.0.0
 * @author https://github.com/suwahas
 * @requires core.js
 */
(function(J) {
  if (!J) {
    console.error('Core JS (J) is not loaded. Core Select cannot be initialized.');
    return;
  }

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
        highlightedIndex: -1,
        isLoading: false,
      };
      this.cache = {}; // For AJAX caching
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
      this.elements.$wrapper = J('<div class="core-select-wrapper"></div>');
      this.elements.$dropdown = J('<div class="core-select-dropdown"></div>').hide();
      
      const originalName = this.elements.$input.attr('name');
      if (originalName) {
        this.elements.$hiddenInput = J(`<input type="hidden" name="${originalName}" />`);
        this.elements.$input.attr('name', `${originalName}-display`);
        this.elements.$wrapper.append(this.elements.$hiddenInput);
      }

      this.elements.$input.attr('placeholder', this.settings.placeholder).attr('autocomplete', 'off');
      this.elements.$input.wrap(this.elements.$wrapper);
      
      this.elements.$wrapper = this.elements.$input.parent();
      this.elements.$wrapper.append(this.elements.$dropdown);
    }

    _bindEvents() {
      this.elements.$input.on('focus', () => this._handleFocus());
      this.elements.$input.on('input', J.debounce((e) => this._handleInput(e), 250));
      this.elements.$input.on('keydown', (e) => this._handleKeyDown(e));
      this.elements.$dropdown.on('click', '.core-select-option', (e) => this._handleSelection(e));
    }

    _handleDocumentClick(e) {
      if (!J(e.target).closest(this.elements.$wrapper).length) {
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
      if (!this.state.isOpen) return;
      e.preventDefault();

      switch (e.key) {
        case 'ArrowDown': this._highlightOption(this.state.highlightedIndex + 1); break;
        case 'ArrowUp': this._highlightOption(this.state.highlightedIndex - 1); break;
        case 'Enter':
          if (this.state.highlightedIndex > -1) {
            this.select(this.state.results[this.state.highlightedIndex]);
          }
          break;
        case 'Escape': this.close(); break;
      }
    }

    _handleSelection(e) {
      const selectedData = J(e.currentTarget).data('core-select-item');
      if (selectedData) this.select(selectedData);
    }

    _search(term) {
      if (this.settings.ajax) {
        if (this.cache[term]) this._renderDropdown(this.cache[term]);
        else this._fetchAjaxData(term);
      } else if (this.settings.data) {
        this._filterLocalData(term);
      }
    }

    _fetchAjaxData(term) {
      if (this.state.isLoading) return;
      this.state.isLoading = true;
      this._renderMessage('Loading...');

      J.ajax({
        ...this.settings.ajax,
        data: { term, ...(this.settings.ajax.data || {}) },
        success: (response) => {
          const results = this.settings.ajax.processResults ? this.settings.ajax.processResults(response) : response;
          this.cache[term] = results;
          this._renderDropdown(results);
        },
        error: (err) => this._renderMessage(`Error: Request failed`),
        complete: () => this.state.isLoading = false,
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
      this.state.highlightedIndex = -1;

      if (results.length === 0) {
        this._renderMessage('No results found');
      } else {
        const newOptions = results.map(item => {
          const itemHtml = this.settings.formatResult(item);
          const $option = J(`<div class="core-select-option">${itemHtml}</div>`);
          $option.data('core-select-item', item);
          return $option[0];
        });
        // Core JS now handles the DocumentFragment optimization internally
        this.elements.$dropdown.append(newOptions);
      }
      this.open();
    }
    
    _renderMessage(message) {
      this.elements.$dropdown.html(`<div class="core-select-message">${message}</div>`);
      this.open();
    }

    _highlightOption(index) {
        const options = this.elements.$dropdown.find('.core-select-option');
        if (options.length === 0) return;

        J(options[this.state.highlightedIndex]).removeClass('highlighted');

        if (index >= options.length) index = 0;
        if (index < 0) index = options.length - 1;

        const newHighlightedOption = J(options[index]).addClass('highlighted');
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
      J(document).on('click', this.boundDocumentClick);
    }

    close() {
      if (!this.state.isOpen) return;
      this.state.isOpen = false;
      this.elements.$dropdown.hide();
      J(document).off('click', this.boundDocumentClick);
    }
    
    destroy() {
      J(document).off('click', this.boundDocumentClick);
      this.elements.$input.off('focus input keydown');
      this.elements.$input.removeData('coreSelectInstance');
      this.elements.$input.attr('name', this.elements.$hiddenInput?.attr('name') || null);
      this.elements.$input.unwrap();
      this.elements.$hiddenInput?.remove();
      this.elements.$dropdown.remove();
    }
  }

  CoreSelect.defaults = {
    placeholder: 'Select an option',
    minimumInputLength: 1,
    data: null,
    ajax: null,
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

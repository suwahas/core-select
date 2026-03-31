/**
 * Core JS
 * A lightweight, modern, and dependency-free JavaScript library that provides
 * a familiar jQuery-like API for DOM manipulation, events, and AJAX.
 *
 * @version 2.0 (Elementor & WP Production Ready)
 * @author https://github.com/suwahas
 * @license MIT
 */
(function (global) {
  'use strict';

  // --- PRIVATE HELPERS ---
  const eventStore = new WeakMap();
  const dataStore = new WeakMap();

  const cssNumber = {
    animationIterationCount: true, columnCount: true, fillOpacity: true, flexGrow: true, flexShrink: true,
    fontWeight: true, gridArea: true, gridColumn: true, gridColumnEnd: true, gridColumnStart: true,
    gridRow: true, gridRowEnd: true, gridRowStart: true, lineHeight: true, opacity: true, order: true,
    orphans: true, widows: true, zIndex: true, zoom: true
  };

  function _swap(elem, options, callback) {
    const old = {};
    for (const name in options) {
      old[name] = elem.style[name];
      elem.style[name] = options[name];
    }
    const result = callback.call(elem);
    for (const name in options) {
      elem.style[name] = old[name];
    }
    return result;
  }

  const wrapMap = {
    option: [1, '<select multiple="multiple">', '</select>'],
    thead: [1, '<table>', '</table>'],
    col: [2, '<table><colgroup>', '</colgroup></table>'],
    tr: [2, '<table><tbody>', '</tbody></table>'],
    td: [3, '<table><tbody><tr>', '</tr></tbody></table>'],
    _default: [0, '', '']
  };
  wrapMap.optgroup = wrapMap.option;
  wrapMap.tbody = wrapMap.tfoot = wrapMap.colgroup = wrapMap.caption = wrapMap.thead;
  wrapMap.th = wrapMap.td;

  function _createNodesFromContent(content) {
    if (typeof content === 'string') {
      const html = content.trim();
      if (!html) return [];

      const tagMatch = /<([a-z][^\/\0>\x20\t\r\n\f]*)/i.exec(html);
      const tag = tagMatch ? tagMatch[1].toLowerCase() : '';
      const wrap = wrapMap[tag] || wrapMap._default;

      const template = document.createElement('template');
      template.innerHTML = wrap[1] + html + wrap[2];

      // Traverse down to the actual content
      let node = template.content;
      let depth = wrap[0];
      while (depth--) {
        node = node.firstElementChild;
      }

      return Array.from(node.childNodes);
    }
    if (content.nodeType) { return [content]; }
    if (content instanceof NodeList || Array.isArray(content) || content instanceof J) {
      return Array.from(content);
    }
    return [];
  }

  function _toCamelCase(str) {
    return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  }

  function _isFunction(obj) {
    return typeof obj === 'function';
  }

  function _isWindow(obj) {
    return obj != null && obj === obj.window;
  }

  function _isPlainObject(obj) {
    return Object.prototype.toString.call(obj) === '[object Object]';
  }

  function _uniqueSort(nodes) {
    const arr = Array.isArray(nodes) ? nodes : Array.from(nodes);
    if (arr.length > 1) {
      arr.sort((a, b) => {
        if (a === b) return 0;
        // 2 = Node.DOCUMENT_POSITION_PRECEDING (b comes before a)
        return a.compareDocumentPosition(b) & 2 ? 1 : -1;
      });
    }
    return arr;
  }

  // --- CONSTRUCTOR ---
  const J = function (selector) {
    return new J.fn.init(selector);
  };

  // --- MAIN PROTOTYPE ---
  J.fn = J.prototype = {
    constructor: J,
    length: 0,
    [Symbol.iterator]: Array.prototype[Symbol.iterator],

    init: function (selector) {
      if (!selector) return this;

      // Handle $(function) -> DOM Ready
      if (_isFunction(selector)) {
        return J.ready(selector);
      }

      if (typeof selector === 'string') {
        selector = selector.trim();
        if (selector.startsWith('<') && selector.endsWith('>')) {
          Array.prototype.push.apply(this, _createNodesFromContent(selector));
        } else {
          try {
            const nodeList = document.querySelectorAll(selector);
            Array.prototype.push.apply(this, nodeList);
          } catch (e) {
            console.warn(`J: Unsupported selector "${selector}"`);
          }
        }
      } else if (selector.nodeType || selector === global) {
        this[0] = selector;
        this.length = 1;
      } else if (selector instanceof NodeList || Array.isArray(selector)) {
        Array.prototype.push.apply(this, selector);
      } else if (selector instanceof J) {
        return selector;
      }

      return this;
    },

    ready: function(fn) {
      J.ready(fn);
      return this;
    },

    each: function (callback) {
      for (let i = 0; i < this.length; i++) {
        if (callback.call(this[i], i, this[i]) === false) break;
      }
      return this;
    },

    // --- DOM TRAVERSAL ---

    find: function (sel) {
      const foundSet = new Set();
      this.each(function () {
        try {
          const nodes = this.querySelectorAll(sel);
          for (let i = 0; i < nodes.length; i++) {
            foundSet.add(nodes[i]);
          }
        } catch (e) {
           console.warn(`J.find: Unsupported selector "${sel}"`);
        }
      });
      return J(_uniqueSort(foundSet));
    },

    closest: function (sel) {
      const closestElements = new Set();
      this.each(function () {
        try {
            const el = this.closest(sel);
            if (el) closestElements.add(el);
        } catch(e) {}
      });
      return J(Array.from(closestElements));
    },

    parent: function () {
      const parents = new Set();
      this.each(function () {
        if (this.parentElement) {
          parents.add(this.parentElement);
        }
      });
      return J(Array.from(parents));
    },

    parents: function(sel) {
      const parents = new Set();
      this.each(function() {
        let parent = this.parentElement;
        while (parent) {
          if (!sel || parent.matches(sel)) {
            parents.add(parent);
          }
          parent = parent.parentElement;
        }
      });
      return J(Array.from(parents));
    },

    children: function (sel) {
      const kids = new Set();
      this.each(function () {
        for (let i = 0; i < this.children.length; i++) {
          kids.add(this.children[i]);
        }
      });
      
      let result = Array.from(kids);
      if (sel) {
        try {
            result = result.filter(kid => kid.matches(sel));
        } catch(e) {}
      }
      return J(_uniqueSort(result));
    },

    siblings: function(sel) {
      const siblings = new Set();
      this.each(function() {
        if (this.parentNode) {
          for (const child of this.parentNode.children) {
            if (child !== this) {
               if (!sel || child.matches(sel)) {
                 siblings.add(child);
               }
            }
          }
        }
      });
      return J(_uniqueSort(siblings));
    },

    prev: function(sel) {
      const res = new Set();
      this.each(function() {
        const prev = this.previousElementSibling;
        if (prev && (!sel || prev.matches(sel))) {
          res.add(prev);
        }
      });
      return J(Array.from(res));
    },

    next: function(sel) {
      const res = new Set();
      this.each(function() {
        const next = this.nextElementSibling;
        if (next && (!sel || next.matches(sel))) {
          res.add(next);
        }
      });
      return J(Array.from(res));
    },

    eq: function(index) {
      const len = this.length;
      const j = +index + (index < 0 ? len : 0);
      return J(this[j]);
    },

    index: function() {
      if (!this[0]) return -1;
      const child = this[0];
      const parent = child.parentNode;
      if (!parent) return -1;
      return Array.prototype.indexOf.call(parent.children, child);
    },

    offsetParent: function() {
       const res = new Set();
       this.each(function() {
         if(this.offsetParent) res.add(this.offsetParent);
       });
       return J(Array.from(res));
    },

    // --- EVENT HANDLING (Enhanced for Namespaces) ---

    on: function (eventTypes, selectorOrHandler, handler) {
      const events = eventTypes.split(' ');
      if (events.length > 1) {
        events.forEach(type => this.on(type, selectorOrHandler, handler));
        return this;
      }

      // Parse "click.a.b"
      const parts = eventTypes.split('.');
      const type = parts[0];
      const namespaces = parts.slice(1).sort();

      if (!type) return this; // Invalid event

      if (typeof selectorOrHandler === 'function') {
        const handlerFn = selectorOrHandler;
        const directHandler = function(event) {
          // Unpack CustomEvent details into standard arguments
          const args = event.detail !== undefined 
            ? (Array.isArray(event.detail) ? [event].concat(event.detail) : [event, event.detail]) 
            : [event];
          return handlerFn.apply(this, args);
        };

        return this.each(function () {
          this.addEventListener(type, directHandler);
          const elementEvents = eventStore.get(this) || new Map();
          
          // Store handler with namespace info
          const typeHandlers = elementEvents.get(type) || [];
          typeHandlers.push({
            original: handlerFn,
            wrapper: directHandler,
            namespaces: namespaces
          });
          
          elementEvents.set(type, typeHandlers);
          eventStore.set(this, elementEvents);
        });
      }
      else if (typeof selectorOrHandler === 'string' && typeof handler === 'function') {
        const selector = selectorOrHandler;
        const delegatedHandler = function (event) {
          let target = event.target;
          // Resolve text nodes to their parent element
          if (target && target.nodeType === 3) { target = target.parentNode; }

          const args = event.detail !== undefined 
            ? (Array.isArray(event.detail) ? [event].concat(event.detail) : [event, event.detail]) 
            : [event];

          while (target && target !== this) {
            // nodeType 1 guarantees it's an Element (which has the .matches method)
            if (target.nodeType === 1 && target.matches(selector)) {
              handler.apply(target, args);
              return;
            }
            target = target.parentNode;
          }
        };
        return this.each(function () {
          this.addEventListener(type, delegatedHandler);
          const elementEvents = eventStore.get(this) || new Map();
          
          const typeHandlers = elementEvents.get(type) || [];
          typeHandlers.push({
            original: handler,
            wrapper: delegatedHandler,
            namespaces: namespaces
          });

          elementEvents.set(type, typeHandlers);
          eventStore.set(this, elementEvents);
        });
      }
      return this;
    },

    off: function (eventTypes, handler) {
      const events = eventTypes.split(' ');
      if (events.length > 1) {
        events.forEach(type => this.off(type, handler));
        return this;
      }

      const parts = eventTypes.split('.');
      const type = parts[0];
      const namespaces = parts.slice(1).sort();

      return this.each(function () {
        const elementEvents = eventStore.get(this);
        if (!elementEvents) return;

        // Helper to remove a specific handler record
        const removeHandler = (eventType, record, index, array) => {
          this.removeEventListener(eventType, record.wrapper);
          array.splice(index, 1);
        };

        // Case 1: .off('.namespace') - Remove ALL events matching namespaces
        if (!type && namespaces.length > 0) {
          for (const [evtType, handlers] of elementEvents.entries()) {
            for (let i = handlers.length - 1; i >= 0; i--) {
              if (namespaces.every(ns => handlers[i].namespaces.includes(ns))) {
                removeHandler(evtType, handlers[i], i, handlers);
              }
            }
            if (handlers.length === 0) elementEvents.delete(evtType);
          }
        }
        // Case 2: .off('click') or .off('click.a.b')
        else if (type && elementEvents.has(type)) {
          const handlers = elementEvents.get(type);
          for (let i = handlers.length - 1; i >= 0; i--) {
            const rec = handlers[i];
            // Match Namespaces (if provided) AND Handler (if provided)
            const nsMatch = namespaces.length === 0 || namespaces.every(ns => rec.namespaces.includes(ns));
            const handlerMatch = !handler || rec.original === handler;

            if (nsMatch && handlerMatch) {
              removeHandler(type, rec, i, handlers);
            }
          }
          if (handlers.length === 0) elementEvents.delete(type);
        }

        if (elementEvents.size === 0) { eventStore.delete(this); }
      });
    },

    trigger: function (eventType, data) {
      const type = eventType.split('.')[0];

      return this.each(function () {
        // Forms require special handling: calling this.submit() does NOT fire a native 
        // submit event. We must dispatch manually first.
        const isSilentNativeMethod = (type === 'submit' || type === 'reset') && this.tagName === 'FORM';
        const isStandardAction = /^(click|focus|blur)$/.test(type);

        // If no custom data is passed, and it's a standard UI action, calling the native 
        // method directly guarantees listeners fire exactly once AND the default action occurs.
        if (data === undefined && isStandardAction && typeof this[type] === 'function') {
          try { this[type](); } catch (e) {}
          return;
        }

        // Fallback: Dispatch a CustomEvent for custom data, silent methods, or custom events
        const event = new CustomEvent(type, {
          bubbles: true,
          cancelable: true,
          detail: data
        });
        
        this.dispatchEvent(event);

        // Execute silent native methods (like form submission) if the event wasn't prevented
        if (!event.defaultPrevented && isSilentNativeMethod && typeof this[type] === 'function') {
          try { this[type](); } catch (e) {}
        }
      });
    },

    // --- CLASS & ATTRIBUTE MANIPULATION ---

    addClass: function (classNames) {
      const classes = classNames.split(' ').filter(Boolean);
      return this.each(function () {
        this.classList.add(...classes);
      });
    },

    removeClass: function (classNames) {
      const classes = classNames.split(' ').filter(Boolean);
      return this.each(function () {
        this.classList.remove(...classes);
      });
    },

    toggleClass: function (classNames) {
      const classes = classNames.split(' ').filter(Boolean);
      return this.each(function () {
        classes.forEach(cls => this.classList.toggle(cls));
      });
    },

    hasClass: function (className) {
      if (!this[0] || !className) return false;
      return this[0].classList.contains(className);
    },

    attr: function (name, value) {
      if (typeof name === 'object') {
        return this.each(function () {
          for (let key in name) {
            this.setAttribute(key, name[key]);
          }
        });
      }
      if (value === undefined) {
        return this[0]?.getAttribute(name);
      }
      return this.each(function () {
        this.setAttribute(name, value);
      });
    },

    removeAttr: function(names) {
      const attrs = names.split(' ').filter(Boolean);
      return this.each(function() {
        attrs.forEach(name => this.removeAttribute(name));
      });
    },

    // --- DOM MANIPULATION ---

    append: function (content) {
      const nodesToAppend = _createNodesFromContent(content);
      if (nodesToAppend.length === 0) return this;

      return this.each(function (index) {
        const fragment = document.createDocumentFragment();
        nodesToAppend.forEach(node => {
          fragment.appendChild(index === 0 ? node : node.cloneNode(true));
        });
        this.appendChild(fragment);
      });
    },

     appendTo: function (target) {
      const targets = J(target);
      const sourceNodes = this;
      if (!targets.length || !sourceNodes.length) return this;

      targets.each(function(index) {
        const fragment = document.createDocumentFragment();
        sourceNodes.each(function() {
          fragment.appendChild(index === 0 ? this : this.cloneNode(true));
        });
        this.appendChild(fragment);
      });
      return sourceNodes;
    },

    prepend: function (content) {
      const nodesToPrepend = _createNodesFromContent(content);
      if (nodesToPrepend.length === 0) return this;

      return this.each(function (index) {
        const fragment = document.createDocumentFragment();
        nodesToPrepend.forEach(node => {
          fragment.appendChild(index === 0 ? node : node.cloneNode(true));
        });
        this.insertBefore(fragment, this.firstChild);
      });
    },

    before: function(content) {
      const nodesToInsert = _createNodesFromContent(content);
      if (nodesToInsert.length === 0) return this;
      
      return this.each(function(index) {
        const parent = this.parentNode;
        if (!parent) return;
        const fragment = document.createDocumentFragment();
        nodesToInsert.forEach(node => {
          fragment.appendChild(index === 0 ? node : node.cloneNode(true));
        });
        parent.insertBefore(fragment, this);
      });
    },
    
    after: function(content) {
      const nodesToInsert = _createNodesFromContent(content);
      if (nodesToInsert.length === 0) return this;

      return this.each(function(index) {
        const parent = this.parentNode;
        if (!parent) return;
        const fragment = document.createDocumentFragment();
        nodesToInsert.forEach(node => {
          fragment.appendChild(index === 0 ? node : node.cloneNode(true));
        });
        parent.insertBefore(fragment, this.nextSibling);
      });
    },

    clone: function() {
      const clonedElements = [];
      this.each(function() {
        clonedElements.push(this.cloneNode(true));
      });
      return J(clonedElements);
    },

    remove: function () {
      return this.each(function () {
        this.remove();
      });
    },

    empty: function () {
      return this.each(function () {
        this.textContent = '';
      });
    },

    // --- GETTERS/SETTERS ---

    hide: function() {
      return this.each(function() {
        if (this.style.display !== 'none') {
          this.dataset.oldDisplay = this.style.display;
          this.style.display = 'none';
        }
      });
    },

    show: function() {
      return this.each(function() {
        // Restore previous inline style if it existed
        this.style.display = this.dataset.oldDisplay || '';
        
        // If a CSS stylesheet is still forcing it to be hidden, override it
        if (getComputedStyle(this).display === 'none') {
          this.style.display = 'block';
        }
      });
    },

    toggle: function(state) {
      return this.each(function() {
        const isHidden = getComputedStyle(this).display === 'none';
        if (typeof state === 'boolean') {
          state ? J(this).show() : J(this).hide();
        } else {
          isHidden ? J(this).show() : J(this).hide();
        }
      });
    },

    css: function (prop, value) {
      if (typeof prop === 'string' && value === undefined) {
        return this[0] ? getComputedStyle(this[0])[_toCamelCase(prop)] : undefined;
      }
      
      const setCssValue = (elem, name, val) => {
        const camelName = _toCamelCase(name);
        if (typeof val === 'number' && !cssNumber[camelName]) {
          val += 'px';
        }
        elem.style[camelName] = val;
      };

      return this.each(function () {
        if (typeof prop === 'object') {
          for (let key in prop) {
            setCssValue(this, key, prop[key]);
          }
        } else {
          setCssValue(this, prop, value);
        }
      });
    },

    data: function (key, value) {
      if (value === undefined) {
        const el = this[0];
        if (!el) return undefined;

        // 1. Check memory store first
        let elementData = dataStore.get(el);
        if (elementData && key in elementData) {
          return elementData[key];
        }

        // 2. Fallback to HTML data-* attribute
        let val = el?.dataset?.[key];
        if (val !== undefined) {
          // Auto-parse JSON/Numbers/Booleans (jQuery compatibility)
          if (val === "true") val = true;
          else if (val === "false") val = false;
          else if (val === "null") val = null;
          else if (val === +val + "") val = +val; // Number check
          else if (val && (val.startsWith('{') || val.startsWith('['))) {
            try { val = JSON.parse(val); } catch(e) {}
          }

          // Cache it in memory for future fast access
          if (!elementData) {
            elementData = {};
            dataStore.set(el, elementData);
          }
          elementData[key] = val;

          return val;
        }
        return undefined;
      }

      // Setter: Store in memory, NOT in DOM attributes
      return this.each(function () {
        let elementData = dataStore.get(this);
        if (!elementData) {
          elementData = {};
          dataStore.set(this, elementData);
        }
        elementData[key] = value;
      });
    },

    html: function (value) {
      if (value === undefined) {
        return this[0]?.innerHTML;
      }
      return this.each(function () {
        this.innerHTML = value;
      });
    },

    text: function (value) {
      if (value === undefined) {
        return this[0]?.textContent;
      }
      return this.each(function () {
        this.textContent = value;
      });
    },

    val: function (value) {
      if (value === undefined) {
        const el = this[0];
        if (!el) return undefined;
        if (el.tagName === 'SELECT' && el.multiple) {
          return Array.from(el.selectedOptions).map(opt => opt.value);
        }
        return el.value;
      }
      return this.each(function () {
        if (this.tagName === 'SELECT' && this.multiple) {
          const values = Array.isArray(value) ? value : [value];
          Array.from(this.options).forEach(opt => opt.selected = values.includes(opt.value));
        } 
        else if (this.type === 'checkbox' || this.type === 'radio') {
          if (Array.isArray(value)) {
            this.checked = value.includes(this.value);
          } else {
            this.value = value == null ? '' : value;
          }
        }
        else {
          this.value = value == null ? '' : value;
        }
      });
    },

    // --- DIMENSIONS & POSITIONING ---

    width: function(value) {
      if (value === undefined) {
        const el = this[0];
        if (!el) return undefined;
        if (_isWindow(el)) return el.innerWidth;
        if (el.nodeType === 9) return el.documentElement.scrollWidth;
        
        const getWidth = () => {
          const style = getComputedStyle(el);
          return el.getBoundingClientRect().width - 
            (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0) - 
            (parseFloat(style.borderLeftWidth) || 0) - (parseFloat(style.borderRightWidth) || 0);
        };
        
        return el.offsetWidth === 0 && getComputedStyle(el).display === 'none' 
          ? _swap(el, { display: 'block', position: 'absolute', visibility: 'hidden' }, getWidth)
          : getWidth();
      }
      return this.css('width', value);
    },

    height: function(value) {
      if (value === undefined) {
        const el = this[0];
        if (!el) return undefined;
        if (_isWindow(el)) return el.innerHeight;
        if (el.nodeType === 9) return el.documentElement.scrollHeight;
        
        const getHeight = () => {
          const style = getComputedStyle(el);
          return el.getBoundingClientRect().height - 
            (parseFloat(style.paddingTop) || 0) - (parseFloat(style.paddingBottom) || 0) - 
            (parseFloat(style.borderTopWidth) || 0) - (parseFloat(style.borderBottomWidth) || 0);
        };

        return el.offsetHeight === 0 && getComputedStyle(el).display === 'none'
          ? _swap(el, { display: 'block', position: 'absolute', visibility: 'hidden' }, getHeight)
          : getHeight();
      }
      return this.css('height', value);
    },

    outerWidth: function(includeMargin) {
      const el = this[0];
      if (!el) return undefined;
      
      const getOuterWidth = () => {
        const rectWidth = el.getBoundingClientRect().width;
        if (!includeMargin) return rectWidth;
        const style = getComputedStyle(el);
        return rectWidth + (parseFloat(style.marginLeft) || 0) + (parseFloat(style.marginRight) || 0);
      };

      return el.offsetWidth === 0 && getComputedStyle(el).display === 'none'
        ? _swap(el, { display: 'block', position: 'absolute', visibility: 'hidden' }, getOuterWidth)
        : getOuterWidth();
    },

    outerHeight: function(includeMargin) {
      const el = this[0];
      if (!el) return undefined;
      
      const getOuterHeight = () => {
        const rectHeight = el.getBoundingClientRect().height;
        if (!includeMargin) return rectHeight;
        const style = getComputedStyle(el);
        return rectHeight + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
      };

      return el.offsetHeight === 0 && getComputedStyle(el).display === 'none'
        ? _swap(el, { display: 'block', position: 'absolute', visibility: 'hidden' }, getOuterHeight)
        : getOuterHeight();
    },

    offset: function() {
      const el = this[0];
      if (!el) return undefined;
      const rect = el.getBoundingClientRect();
      return {
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX
      };
    },

    position: function() {
      const el = this[0];
      if (!el) return undefined;
      return {
        top: el.offsetTop,
        left: el.offsetLeft
      };
    },

    scrollTop: function(value) {
      if (value === undefined) {
        const el = this[0];
        if (!el) return undefined;
        return _isWindow(el) ? el.scrollY : el.scrollTop;
      }
      return this.each(function() {
        if (_isWindow(this)) this.scrollTo(this.scrollX, value);
        else this.scrollTop = value;
      });
    },
    
    // --- FORM METHODS ---

    serialize: function() {
      const query = [];
      const elements = [];

      // Collect all valid form elements (either from a form or independent inputs)
      this.each(function() {
        if (this.tagName === 'FORM') {
          Array.prototype.push.apply(elements, this.elements);
        } else {
          elements.push(this);
        }
      });

      elements.forEach(el => {
        if (!el.name || el.disabled) return;
        
        const type = el.type ? el.type.toLowerCase() : '';
        if (['file', 'reset', 'submit', 'button'].includes(type)) return;
        if (['checkbox', 'radio'].includes(type) && !el.checked) return;

        if (el.tagName === 'SELECT' && el.multiple) {
          Array.from(el.selectedOptions).forEach(opt => {
            query.push(encodeURIComponent(el.name) + '=' + encodeURIComponent(opt.value));
          });
        } else {
          query.push(encodeURIComponent(el.name) + '=' + encodeURIComponent(el.value));
        }
      });

      return query.join('&');
    }
  };

  J.fn.init.prototype = J.fn;

  // --- STATIC METHODS ---
  
  J.extend = function() {
    let target = arguments[0] || {};
    let i = 1;
    let deep = false;

    if (typeof target === 'boolean') {
      deep = target;
      target = arguments[i] || {};
      i++;
    }

    if (typeof target !== 'object' && !_isFunction(target)) {
      target = {};
    }

    for (; i < arguments.length; i++) {
      const source = arguments[i];
      if (source != null) {
        for (const key in source) {
          if (Object.prototype.hasOwnProperty.call(source, key)) {
            // Prevent Prototype Pollution
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
            
            const src = target[key];
            const copy = source[key];
            if (target === copy) continue;
            if (deep && copy && (_isPlainObject(copy) || Array.isArray(copy))) {
              const clone = Array.isArray(copy) ? (Array.isArray(src) ? src : []) : (_isPlainObject(src) ? src : {});
              target[key] = J.extend(deep, clone, copy);
            } else if (copy !== undefined) {
              target[key] = copy;
            }
          }
        }
      }
    }
    return target;
  };

  J.ready = function (fn) {
    if (document.readyState !== 'loading') {
      fn(J);
    } else {
      document.addEventListener('DOMContentLoaded', () => fn(J));
    }
  };

  J.debounce = function (func, wait) {
    let timeout;
    return function (...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  };

  // --- AJAX MODULE ---
  function serializeParams(params) {
    if (!params || typeof params !== 'object') return '';
    const query = [];

    const add = (key, value) => {
      // Execute functions (jQuery compat) and convert null/undefined to empty strings
      const val = typeof value === 'function' ? value() : (value == null ? '' : value);
      query.push(encodeURIComponent(key) + '=' + encodeURIComponent(val));
    };

    const buildParams = (prefix, obj) => {
      if (Array.isArray(obj)) {
        for (let i = 0, len = obj.length; i < len; i++) {
          const value = obj[i];
          if (prefix.endsWith('[]')) {
            // Treat as traditional array append
            add(prefix, value);
          } else {
            // If it's a complex object, include the index. Otherwise, empty brackets.
            buildParams(prefix + '[' + (typeof value === 'object' && value !== null ? i : '') + ']', value);
          }
        }
      } else if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            buildParams(prefix + '[' + key + ']', obj[key]);
          }
        }
      } else {
        add(prefix, obj);
      }
    };

    for (const key in params) {
      if (Object.prototype.hasOwnProperty.call(params, key)) {
        buildParams(key, params[key]);
      }
    }

    return query.join('&');
  }

  J.ajax = function ({
    url,
    method = 'GET',
    headers = {},
    data = null,
    responseType = 'json',
    contentType = 'application/x-www-form-urlencoded; charset=UTF-8',
    timeout = 0,
    beforeSend = () => {},
    success = () => {},
    error = () => {},
    complete = () => {},
    context = null
  } = {}) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let finalUrl = url;
      let sendData = null;

      if (method.toUpperCase() === 'GET' && data && typeof data === 'object') {
        const queryString = serializeParams(data);
        finalUrl += (url.includes('?') ? '&' : '?') + queryString;
      } else if (data) {
        if (contentType.includes('json')) {
          sendData = JSON.stringify(data);
        } else if (contentType.includes('x-www-form-urlencoded')) {
          sendData = serializeParams(data);
        } else {
          sendData = data;
        }
      }

      xhr.open(method, finalUrl, true);
      if (responseType) xhr.responseType = responseType;
      Object.entries(headers).forEach(([key, val]) => xhr.setRequestHeader(key, val));
      if (method.toUpperCase() !== 'GET' && contentType && !headers['Content-Type']) {
        xhr.setRequestHeader('Content-Type', contentType);
      }
      if (timeout > 0) xhr.timeout = timeout;

      try { beforeSend.call(context, xhr); } catch (e) { console.warn('beforeSend hook error:', e); }

      xhr.onload = () => {
        const isSuccess = xhr.status >= 200 && xhr.status < 400;
        let responseData = ('response' in xhr) ? xhr.response : xhr.responseText;
        if (xhr.responseType === 'json' && typeof responseData === 'string') {
            try { responseData = JSON.parse(responseData); } catch (e) { /* ignore parse error */ }
        }
        
        if (isSuccess) {
          const textStatus = xhr.status === 204 ? 'nocontent' : xhr.status === 304 ? 'notmodified' : 'success';
          success.call(context, responseData, textStatus, xhr);
          resolve(responseData);
          complete.call(context, xhr, textStatus);
        } else {
          const textStatus = 'error';
          const errorThrown = xhr.statusText || `Error ${xhr.status}`;
          const err = new Error(errorThrown);
          error.call(context, xhr, textStatus, errorThrown);
          reject(err);
          complete.call(context, xhr, textStatus);
        }
      };
      xhr.onerror = () => {
        const err = new Error('Network error');
        error.call(context, xhr, 'error', err.message);
        reject(err);
        complete.call(context, xhr, 'error');
      };
      xhr.ontimeout = () => {
        const err = new Error('Request timed out');
        error.call(context, xhr, 'timeout', err.message);
        reject(err);
        complete.call(context, xhr, 'timeout');
      };
      xhr.send(sendData);
    });
  };

  J.get = function (url, data, success, options) {
    if (typeof data === 'function') {
        options = { success: data };
        data = null;
    }
    return J.ajax({ url, method: 'GET', data, success, ...options });
  };

  J.post = function (url, data, success, options) {
    if (typeof data === 'function') {
        options = { success: data };
        data = null;
    }
    return J.ajax({
      url,
      method: 'POST',
      data,
      success,
      contentType: 'application/json; charset=UTF-8',
      ...options
    });
  };

  // --- EXPOSE UTILITIES FOR COMPAT LAYER ---
  J.isFunction = _isFunction;
  J.isWindow = _isWindow;
  J.isPlainObject = _isPlainObject;
  J.camelCase = _toCamelCase;

  // --- EXPORT ---
  global.J = J;
  if (typeof global.jQuery === 'undefined') { global.jQuery = J; }
  if (typeof global.$ === 'undefined') { global.$ = J; }

})(typeof window !== 'undefined' ? window : this);

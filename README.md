# Core Select: A Modern Select Box Plugin for Core JS

## Why Core Select? The Modern Advantage

Core Select is not just another select box replacement; it's a high-performance component built with modern development practices in mind. It provides a superior user experience while being architecturally robust.

*   **Fast & Performant**
    *   **Efficient Rendering:** Leverages the optimized `DocumentFragment` rendering in Core JS, making it incredibly fast even with hundreds of results.
    *   **Event Delegation:** Uses a single event listener for all dropdown options, no matter how many there are. This is vastly more performant than attaching a listener to every single item.
    *   **AJAX Caching:** Automatically caches AJAX search results, preventing duplicate network requests and providing an instant experience for repeated searches.

*   **Fully Accessible**
    *   **Complete Keyboard Navigation:** Users can fully operate the component without a mouse (Up/Down arrows to navigate, `Enter` to select, `Escape` to close).
    *   **ARIA-Ready (Foundation):** The structure is built to easily add ARIA attributes for screen readers.

*   **Modern & Robust Architecture**
    *   **Built for SPAs:** Includes a critical `destroy()` method that completely cleans up event listeners and DOM elements, preventing memory leaks in single-page applications (like those built with React, Vue, or Angular).
    *   **Clean, Class-Based Design:** The plugin is written as a modern JavaScript class, making it maintainable, predictable, and easy to extend.
    *   **Programmatic Control:** A full public API allows you to `open`, `close`, `select`, or `destroy` the component from your own code.

*   **Flexible & Powerful**
    *   **Local & Remote Data:** Seamlessly supports both predefined JavaScript arrays and live searching against a remote server via AJAX.
    *   **Customizable:** Easily customize the display of results, selections, and handle complex API data with formatter functions.

## Setup

1.  Include `core.js` in your project.
2.  Include the `core-select.js` plugin file **after** `core.js`.
3.  Include the provided `core-select.css` stylesheet, or add the styles to your main CSS file.

**HTML:**
```html
<head>
    <!-- ... other head elements ... -->
    <link rel="stylesheet" href="path/to/core-select.css">
</head>
<body>
    <!-- Your content -->

    <script src="path/to/core.js"></script>
    <script src="path/to/core-select.js"></script>
    <script src="path/to/your-app.js"></script>
</body>
```

## Usage Examples

### Example 1: Basic Usage with Local Data

This is the simplest way to get started, using a predefined array of options.

**HTML:**
```html
<label for="state-selector">Select a State:</label>
<input type="text" id="state-selector" style="width: 300px;">
```

**JavaScript:**
```javascript
J.ready(() => {
  const states = [
    { id: 'AL', text: 'Alabama' },
    { id: 'AK', text: 'Alaska' },
    { id: 'AZ', text: 'Arizona' },
    { id: 'AR', text: 'Arkansas' },
    { id: 'CA', text: 'California' },
    // ... and so on
  ];

  J('#state-selector').coreSelect({
    placeholder: 'Search for a state...',
    data: states,
    onSelect: function(selectedItem) {
      // This function is called when a user makes a selection
      console.log('You selected:', selectedItem);
      // => { id: 'CA', text: 'California' }
    }
  });
});
```

### Example 2: Advanced Usage with AJAX

This powerful feature allows live searching against a server-side API. Here, we'll search GitHub repositories.

**HTML:**
```html
<label for="repo-selector">Search GitHub Repositories:</label>
<!-- The `name="repo"` attribute ensures the selected repo ID will be submitted with a form -->
<input type="text" id="repo-selector" name="repo" style="width: 400px;">
```

**JavaScript:**
```javascript
J.ready(() => {
  J('#repo-selector').coreSelect({
    placeholder: 'Search for a repository...',
    minimumInputLength: 2, // Don't start searching until 2 characters are typed

    ajax: {
      url: 'https://api.github.com/search/repositories',
      // We can pass extra static query parameters here
      data: { per_page: 10 },
      // This function transforms the API response into the {id, text} format Core Select needs
      processResults: function(response) {
        return response.items.map(item => ({
          id: item.id,
          text: item.full_name,
          // You can include any extra data you want to use later
          description: item.description,
          url: item.html_url
        }));
      }
    },

    // Custom function to format how each item appears in the dropdown
    formatResult: function(item) {
        return `
            <div style="font-weight: bold;">${item.text}</div>
            <small style="color: #555;">${item.description || 'No description'}</small>
        `;
    },

    // Custom function to format the selected item in the input box
    formatSelection: function(item) {
        return item.text;
    },
    
    onSelect: function(selectedItem) {
      console.log('Selected Repo ID:', selectedItem.id);
      console.log('Repo URL:', selectedItem.url);
    }
  });
});
```

## Configuration Options

You can pass an object of options during initialization: `J('#my-input').coreSelect({ ... });`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `placeholder` | `String` | `'Select an option'` | The placeholder text for the input field. |
| `minimumInputLength` | `Number` | `1` | The minimum number of characters required to trigger a search. |
| `data` | `Array` \| `null` | `null` | An array of local data objects. Each object must have `id` and `text` properties. |
| `ajax` | `Object` \| `null` | `null` | Configuration object for AJAX requests. See `J.ajax` options. Must include a `url`. |
| `ajax.processResults` | `Function` | `(data) => data` | A function to transform the AJAX response into the required `[{id, text}, ...]` format. |
| `onSelect` | `Function` | `() => {}` | A callback function that fires when an item is selected. It receives the selected data object as its only argument. |
| `formatResult` | `Function` | `(item) => item.text` | A function that returns an HTML string for how an item should be displayed in the dropdown list. |
| `formatSelection` | `Function` | `(item) => item.text` | A function that returns a plain text string for how a selected item should be displayed in the input field. |

## Public API (Programmatic Control)

You can call public methods on an initialized Core Select instance.

**Pattern:** `J('#my-selector').coreSelect('methodName', [arguments...]);`

*   **`select(itemObject)`**
    Programmatically selects an item. You must provide the full item object, not just an ID.
    ```javascript
    const preSelectedItem = { id: 'CA', text: 'California' };
    J('#state-selector').coreSelect('select', preSelectedItem);
    ```

*   **`open()`**
    Manually opens the dropdown.
    ```javascript
    J('#repo-selector').coreSelect('open');
    ```

*   **`close()`**
    Manually closes the dropdown.
    ```javascript
    J('#repo-selector').coreSelect('close');
    ```

*   **`destroy()`**
    Completely removes the plugin, unbinds all events, and restores the original input element. This is crucial for preventing memory leaks in single-page applications.
    ```javascript
    J('#state-selector').coreSelect('destroy');
    ```

## CSS Customization

The provided `core-select.css` is a functional starting point. You can easily override the styles to match your application's design. Key classes to target include:

*   `.core-select-wrapper`
*   `.core-select-dropdown`
*   `.core-select-option`
*   `.core-select-option.highlighted` (for the keyboard-selected item)
*   `.core-select-message` (for "Loading...", "No results", etc.)

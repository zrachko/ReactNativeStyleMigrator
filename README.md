# ReactNativeStyleMigrator

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2012.0.0-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful Node.js script that automatically transforms inline styles in React Native components to StyleSheet objects, improving performance and maintainability.

## ✨ Features

- 🔍 Finds all inline `style={{...}}` declarations in .tsx files
- 🏗️ Creates or updates `localStyles` StyleSheet object
- 🏷️ Generates meaningful style names based on component context
- 🔄 Preserves existing styles when updating
- 📦 Handles StyleSheet imports automatically
- 🛡️ Safe processing with comprehensive error handling

## 📦 Installation

1. Ensure you have Node.js (v12+) installed
2. Add the script to your project:

```bash
npm install @babel/parser @babel/traverse @babel/types @babel/generator --save-dev
```
## 🚀 Usage

- Place the script in your project root
- Run it from the command line:
```bash
node styleMigrator.js
```
#### The script will:

- Process all .tsx files recursively
- Transform inline styles to StyleSheet references
- Create/update localStyles in each file
- Preserve your original code formatting
- 
## 🛠️ Configuration

- The script works with zero configuration, but you can customize:

- localStyles name by changing the constant in the script
Style naming convention by modifying generateStyleName function
## 📝 Example

#### Before:

```tsx

const MyComponent = () => {
    return <View style={{ flex: 1, padding: 16 }} />;
};
```
### After:
```tsx
const MyComponent = () => {
    return <View style={localStyles.mycomponent_view_flex_padding} />;
};


const localStyles = StyleSheet.create({
    mycomponent_view_flex_padding: { flex: 1, padding: 16 }
});
````
## 🤝 Contributing

Contributions are welcome! Please open an issue or PR for any improvements.

## 📜 License

MIT

## 📋 Script Description

**File:** `styleMigrator.js`

This script performs the following operations:

1. **Recursive File Processing**:
   - Scans all directories and subdirectories
   - Processes only .tsx files

2. **AST Transformation**:
   - Uses Babel parser to create AST
   - Traverses and modifies the AST safely
   - Preserves original code structure

3. **Style Migration**:
   - Identifies inline style objects
   - Checks for variable usage (skips if found)
   - Generates meaningful style names
   - Creates/updates StyleSheet declarations

4. **Import Management**:
   - Automatically adds StyleSheet import if missing
   - Preserves existing import declarations

5. **Safe Code Generation**:
   - Comprehensive error handling
   - Type checking for all AST operations
   - Preserves code formatting where possible

## 💡 Key Algorithms

1. **Style Name Generation**:
```javascript
function generateStyleName(node, componentName) {
  // Uses component name + element name + style properties
  // Example: 'mycomponent_view_flex_padding'
}
````

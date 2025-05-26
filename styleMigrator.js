const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');
const generator = require('@babel/generator').default;

async function processFiles(directory) {
  const entries = await fs.promises.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await processFiles(fullPath);
    } else if (entry.name.endsWith('.tsx')) {
      await processFile(fullPath);
    }
  }
}

function generateStyleName(node, componentName) {
  try {
    const elementName = (node.parent &&
        node.parent.name &&
        node.parent.name.name)
        ? node.parent.name.name
        : 'View';

    const styleProps = [];
    if (node.value &&
        node.value.expression &&
        node.value.expression.properties) {
      for (const prop of node.value.expression.properties) {
        if (prop && prop.key && prop.key.name) {
          styleProps.push(prop.key.name.charAt(0).toUpperCase() + prop.key.name.slice(1));
        }
      }
    }

    let styleName = `${(componentName.charAt(0).toLowerCase() + componentName.slice(1))}${elementName}`;
    if (styleProps.length > 0) {
      styleName += `${styleProps.join('')}`;
    }


    return styleName || 'container';
  } catch (error) {
    console.error('Error generating style name:', error);
    return 'container';
  }
}

async function processFile(filePath) {
  console.log(`Processing ${filePath}...`);
  const code = await fs.promises.readFile(filePath, 'utf8');

  try {
    const ast = parse(code, {
      sourceType: 'module',
      plugins: [
        'jsx',
        'typescript',
        'classProperties',
      ],
    });

    let hasStyleSheetImport = false;
    let styleSheetImportName = 'StyleSheet';
    let localStylesNode = null;
    const localStylesName = 'localStyles';
    let stylesToMove = [];
    let componentName = 'Component';

    // Определяем имя компонента
    traverse(ast, {
      ExportDefaultDeclaration(path) {
        const decl = path.node.declaration;
        if (t.isIdentifier(decl)) {
          componentName = decl.name;
        } else if (t.isFunctionDeclaration(decl) && decl.id) {
          componentName = decl.id.name;
        } else if (t.isVariableDeclaration(decl)) {
          const declarator = decl.declarations[0];
          if (t.isIdentifier(declarator?.id)) {
            componentName = declarator.id.name;
          }
        }
      }
    });

    // Проверяем импорты
    traverse(ast, {
      ImportDeclaration(path) {
        if (path.node.source.value === 'react-native') {
          path.node.specifiers.forEach(specifier => {
            if (t.isImportSpecifier(specifier) && specifier.imported.name === 'StyleSheet') {
              hasStyleSheetImport = true;
              styleSheetImportName = specifier.local.name;
            }
          });
        }
      }
    });

    // Ищем существующий localStyles
    traverse(ast, {
      VariableDeclarator(path) {
        if (path.node.id.name === localStylesName) {
          localStylesNode = path.node;
        }
      }
    });

    // Ищем inline стили
    traverse(ast, {
      JSXAttribute(path) {
        if (path.node.name.name !== 'style') return;

        const value = path.node.value;
        if (!value || !t.isJSXExpressionContainer(value)) return;

        const expression = value.expression;
        if (!t.isObjectExpression(expression)) return;

        let hasVariables = false;

        // Проверяем на наличие переменных
        path.traverse({
          Identifier(innerPath) {
            if (innerPath.parentPath.isObjectProperty() && innerPath.parentPath.node.key === innerPath.node) {
              return;
            }
            hasVariables = true;
            innerPath.stop();
          },
          MemberExpression(innerPath) {
            hasVariables = true;
            innerPath.stop();
          }
        });

        if (!hasVariables && expression.properties.length > 0) {
          const styleName = generateStyleName(path.node, componentName);
          stylesToMove.push({
            path,
            styleName,
            styleObject: expression
          });
        }
      }
    });

    if (stylesToMove.length === 0) {
      console.log(`No styles to move in ${filePath}`);
      return;
    }

    // Добавляем импорт StyleSheet если нужно
    if (!hasStyleSheetImport) {
      const importSpecifier = t.importSpecifier(
          t.identifier('StyleSheet'),
          t.identifier('StyleSheet')
      );
      const importDeclaration = t.importDeclaration(
          [importSpecifier],
          t.stringLiteral('react-native')
      );
      ast.program.body.unshift(importDeclaration);
    }

    // Обрабатываем localStyles
    if (!localStylesNode) {
      // Создаем новый localStyles
      const styleProperties = stylesToMove.map(({ styleName, styleObject }) =>
          t.objectProperty(t.identifier(styleName), styleObject)
      );

      const localStylesObject = t.objectExpression(styleProperties);
      const styleSheetCreateCall = t.callExpression(
          t.memberExpression(
              t.identifier(styleSheetImportName),
              t.identifier('create')
          ),
          [localStylesObject]
      );

      const localStylesDeclaration = t.variableDeclaration('const', [
        t.variableDeclarator(
            t.identifier(localStylesName),
            styleSheetCreateCall
        ),
      ]);

      // Вставляем перед экспортом или в конец файла
      let insertPos = ast.program.body.findIndex(node =>
          t.isExportDefaultDeclaration(node) || t.isExportNamedDeclaration(node)
      );
      insertPos = insertPos === -1 ? ast.program.body.length : insertPos;
      ast.program.body.splice(insertPos, 0, localStylesDeclaration);
    } else {
      // Обновляем существующий localStyles
      traverse(ast, {
        CallExpression(path) {
          if (t.isMemberExpression(path.node.callee) &&
              path.node.callee.object.name === styleSheetImportName &&
              path.node.callee.property.name === 'create' &&
              path.parent.id?.name === localStylesName) {

            const stylesObject = path.node.arguments[0];
            if (t.isObjectExpression(stylesObject)) {
              stylesToMove.forEach(({ styleName, styleObject }) => {
                const exists = stylesObject.properties.some(
                    prop => t.isObjectProperty(prop) && prop.key.name === styleName
                );
                if (!exists) {
                  stylesObject.properties.push(
                      t.objectProperty(t.identifier(styleName), styleObject)
                  );
                }
              });
            }
          }
        }
      });
    }

    // Заменяем inline стили
    stylesToMove.forEach(({ path: stylePath, styleName }) => {
      stylePath.node.value = t.jsxExpressionContainer(
          t.memberExpression(
              t.identifier(localStylesName),
              t.identifier(styleName)
          )
      );
    });

    // Генерируем новый код
    const output = generator(ast, {
      retainLines: false,
      concise: false,
    }, code);

    await fs.promises.writeFile(filePath, output.code);
    console.log(`Successfully updated ${filePath}`);

  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

processFiles(process.cwd()).catch(console.error);
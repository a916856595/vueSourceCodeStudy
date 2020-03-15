(function (global, document) {

    const utilities = {
        objToStr: Object.prototype.toString,
        // 返回复杂类型字符串
        getObjToStrText (value) {
            return utilities.objToStr.call(value).slice(8, -1);
        },
        // 判断是否是对象
        isObject (value) {
            return this.getObjToStrText(value) === 'Object';
        },
        isFunc (value) {
            return this.getObjToStrText(value) === 'Function';
        },
        // 判断是否元素节点
        isElementNode (node) {
            return node.nodeType === 1;
        },
        // 判断是否文本节点
        isTextNode (node) {
            return node.nodeType === 3;
        }
    };

    const arrMethods = {
        forEach (source, func, instance) {
            Array.prototype.forEach.call(source, func, instance);
        },
        map (source, func, instance) {
            Array.prototype.map.call(source, func, instance);
        },
        // 将指定位置的数组项移动到第一个
        moveToFirst (arr, index) {
            arr.unshift(arr.splice(index, 1)[0]);
        },
    };

    const strMethods = {
      firstLetterToUpperCase (str) {
          let result = '';
          if (str.length) {
              result = `${str[0].toUpperCase()}${str.slice(1)}`;
          }
          return result;
      }
    };

    class DataMethods {
        // 获取数据的方法，field是$data的属性名称，以(.)组合
        static getValue (dataObject, field) {
            return field.split('.').reduce((currentData, fieldName) => {
                return currentData[fieldName];
            }, dataObject);
        }
        // 设置值的方法
        static setValue (dataObject, field, value) {
            const fieldNameList = field.split('.');
            const length = fieldNameList.length;
            const lastField = fieldNameList[length - 1];
            const fatherObject = fieldNameList.slice(0, length - 1).reduce((currentData, fieldName) => {
                return currentData[fieldName];
            }, dataObject);
            fatherObject[lastField] = value;
        }
        // 批量获取值
        static mapGetValue (dataObject, fields) {
            if (!fields) return [];
            return fields.map(field => {
                return DataMethods.getValue(dataObject, field);
            });
        }
    }

    class Directive {
        // TODO 当前只支持(v-)开头的指令，后续添加（：）（@）
        static directiveRegExp = /^v-\w+/;
        // 匹配指令属性的标识
        static directiveUselessPartRegExp = /^v-/;
        // 获取指令属性List
        static getDirectives (vm, node) {
            const directives = [];
            const attributes = node.attributes;
            const attributesLength = attributes.length;
            if (attributesLength) {
                // 将解析后的指令信息放入List
                arrMethods.forEach(attributes, attribute => {
                    // 只有通过校验的属性才认为是指令
                    if (this.checkAttributeIsDirective(attribute)) {
                        directives.push(this.getDirectiveDescription(vm, attribute));
                    }
                });
            }
            return directives;
        }
        // 解析并返回指令信息
        static getDirectiveDescription (vm, attribute) {
            const { name, value } = attribute;
            return {
                originKey: name,                 // 原始指令名称
                originValue: value,              // 原指令值
                key: this.getDirectiveKey(name), // 指令名称
                value: Expression.getExpressionResult(vm, value),   // 指令的值
            }
        }
        // 获取单个指令的名称，不包含前缀
        static getDirectiveKey (keyField) {
            return keyField.replace(this.directiveUselessPartRegExp, '');
        }
        // 校验属性是否是一个指令属性
        static checkAttributeIsDirective (attribute) {
            const { name } = attribute;
            return this.directiveRegExp.test(name);
        }
    }

    class DirectiveNode extends Directive {
        node = null;
        // 编译指令节点
        constructor (vm, node, directives) {
            super();
            // 首先获取将要执行的指令类型及顺序
            BuiltInDirectiveCompileMethods.builtInDirectiveEffectiveOrderList.forEach(builtInDirectiveName => {
                directives.forEach((directiveInfo, directiveIndex) => {
                    const { key } = directiveInfo;
                    // 如果指令名称匹配成功则依次移动到数组的第一项
                    if (builtInDirectiveName === key) arrMethods.moveToFirst(directives, directiveIndex);
                });
            });
            this.updateDirectiveNode(vm, node, directives);
        }
        updateDirectiveNode (vm, node, directives) {
            const elementNode = new ElementNode(node);
            // 迭代编译指令,如果返回null,则结束编译
            directives.every(directiveInfo => {
                const { key, originKey } = directiveInfo;
                // 获取内置指令的编译名称
                const compileMethodName = BuiltInDirectiveCompileMethods.getCompileMethodName(key);
                // 如果没有匹配到方法名称，则说明当前指令未注册，将节点原样返回继续编译
                if (!compileMethodName) {
                    throw(new Error(`[warn] directive name ${originKey} is not registered!`));
                    return elementNode.getNode();
                }
                this.node = BuiltInDirectiveCompileMethods[compileMethodName](vm, elementNode, directiveInfo);
            })
        }
    }

    class BuiltInDirectiveCompileMethods {
        // 内置指令生效的顺序,为了方便调用unshift方法，这里倒序;
        static builtInDirectiveEffectiveOrderList = ['model', 'text', 'if', 'for'];
        // 获取编译内置指令的方法名
        static getCompileMethodName (keyOfMethod) {
            if (this.builtInDirectiveEffectiveOrderList.includes(keyOfMethod)) {
                const middleStr = strMethods.firstLetterToUpperCase(keyOfMethod);
                return `compile${middleStr}Directive`;
            }
        }
        // 编译if指令
        static compileIfDirective (vm, elementNode, directiveInfo) {
            const { value } = directiveInfo;
            if (value) return elementNode.getNode();
            return null;
        }
        static compileTextDirective (vm, elementNode, directiveInfo) {
            const { value } = directiveInfo;
            const node = elementNode.getNode();
            node.innerText = value;
            return node;
        }
        static compileModelDirective (vm, elementNode, directiveInfo) {
            const { value, originValue } = directiveInfo;
            const node = elementNode.getNode();
            if (elementNode.isInputNode) {
                node.value = value;
                node.addEventListener('input', event => {
                    const inputValue = event.target.value;
                    DataMethods.setValue(vm.$data, originValue, inputValue);
                });
            } else node.innerText = value;
            return node;
        }
    }

    // 表达式类
    class Expression {
        // 匹配模板中的变量
        static expressionVariableRegExp = /(?<!(['"\w$]\s*))[_$a-zA-Z]+(\.?[\w]+)*(?!\s*['"\w$])/g;
        static variableRegExp = /^[a-zA-Z_$]+[\w$]*$/;              // 匹配标准变量命名方式
        static expressionStringRegExp =  /{\s*{(.*?)}\s*}/g;        // 匹配单个表达式,包括花括号
        static expressionUselessPartRegExp =  /{\s*{|}\s*}/g;       // 匹配单个表达式中的花括号
        static globalVariableNameList = ['true', 'false', 'undefined', 'null'];
        // 获取单个插值表达式的结果
        static getExpressionResult (vm, expression) {
            // 获取变量名称列表
            let variableNameList = expression.match(this.expressionVariableRegExp);
            // 过滤全局常量
            if (variableNameList) variableNameList = this.getFilterGlobalVariable(variableNameList);
            // 如果没有找到变量就是null
            const paramsOfFunction = this.getVariablesAndExpressionAfterTransform(variableNameList, expression);
            let fn;
            // 如果表达式解析失败，则抛出异常及表达式
            try {
                fn = new Function(...paramsOfFunction);
            } catch (err) {
                throw(new Error(`[warn] parse expression [${expression}] error!`));
            }
            const paramsOfCallFunction = DataMethods.mapGetValue(vm.$data, variableNameList);
            return fn(...paramsOfCallFunction);
        };
        // 获取插值模板的转换结果
        static getTemplateExpressionResult (vm, node) {
            return node.textContent
                .replace(this.expressionStringRegExp, strMatched => {  // 匹配到所有的{{ }}内容
                    // 去除表达式的花括号
                    const currentExpression = strMatched.replace(this.expressionUselessPartRegExp, '');
                    // 将表达式中的变量替换为变量值
                    return this.getExpressionResult(vm, currentExpression);
                });
        };
        // 排除掉true,false等全局常量
        static getFilterGlobalVariable (variables) {
            let result = null;
            if (variables) {
               result = [];
               variables.forEach(variableName => {
                   if (!this.globalVariableNameList.includes(variableName)) result.push(variableName);
               });
            }
            return result;
        };
        // 将包含(.)的取属性变量名称转换成常规变量名并替换表达式中对应的值
        static getVariablesAndExpressionAfterTransform (variableNameList, expression) {
            let expressionResult = `return ${expression}`;
            let result = [];
            let namedIndex = 0;
            if (variableNameList) {
                result = variableNameList.map(variableName => {
                    if (this.variableRegExp.test(variableName)) {
                        return variableName;
                    }
                    const newName = `$_place${namedIndex}`;
                    const fieldRegExp = new RegExp(variableName);
                    expressionResult = expressionResult.replace(fieldRegExp, newName);
                    namedIndex += 1;
                    return newName;
                });
            }
            result.push(expressionResult);
            return result;
        }
    }

    class Compile {
        constructor(vm) {
            // 获取模板的根节点及内容
            const virtualDom = this.transformTemplateToVirtualDom(vm.$template);
            // 开始替换临时节点中的内容
            this.transformVirtualDomContent(vm, virtualDom);
            // 替换挂载元素
            this.mount(virtualDom, vm.$el);
        }
        transformTemplateToVirtualDom (template) {
            // 这里不使用DocumentFragment,原因是它不能使用innerHTML属性
            const temporaryNode = document.createElement('div');
            // 将临时节点的内容替换成功模板的内容
            temporaryNode.innerHTML = template;
            // Warning: 处于性能考虑，一般情况下模板应只有一个根节点
            const childrenNodes = temporaryNode.children;
            if (childrenNodes.length > 1) throw(new Error('模板应只有一个根节点'));
            return childrenNodes[0];
        }
        transformVirtualDomContent (vm, virtualDom) {
            const childNodes = virtualDom.childNodes;
            arrMethods.forEach(childNodes, node => {
                if (utilities.isElementNode(node)) this.transformElementNode(vm, node);
                else if (utilities.isTextNode(node)) this.transformTextNode(vm, node);
            }, childNodes);
        }
        // 对元素节点进行修改
        transformElementNode (vm, node) {
            // 获取指令List
            const nodeDirectives = Directive.getDirectives(vm, node);
            const parentNode = node.parentNode;
            let nodeAfterCompile = null;
            if (nodeDirectives.length) {
                nodeAfterCompile = new DirectiveNode(vm, node, nodeDirectives).node;
            }
            if (nodeAfterCompile === null) parentNode.removeChild(node);
        }
        // 对文本节点进行修改
        transformTextNode (vm, node) {
            const expressionResult = Expression.getTemplateExpressionResult(vm, node);
            node.textContent = expressionResult;
        }
        mount (sourceElement, targetElement) {
            // 通过父节点替换节点
            targetElement.parentNode.replaceChild(sourceElement, targetElement);
        }
    }

    // 观察数据类
    // TODO 这里需要添加观察数组变化的方法
    class Observer {
        constructor(vm) {
            this.observeObject(vm.$data);
        }
        observeObject (obj) {
            for (const fieldName in obj) {
                const value = obj[fieldName];
                this.observe(obj, fieldName, value);
                // 如果这个值是对象，则需要递归观察对象
                if (typeof value === 'object') {
                    this.observeObject(value);
                }
            }
        }
        // 观察方法
        observe (dataSource, fieldName, value) {
            Object.defineProperty(dataSource, fieldName, {
                get () {
                    return value;
                },
                set: (newValue) => {
                    console.log(fieldName + '=>' + newValue)
                    // 在给数据重新赋值的时候，需要检查新值是否为对象，如果是，那么需要观察数据
                    if (utilities.isObject(newValue)) {
                        this.observeObject(newValue);
                    }
                    value = newValue;
                }
            })
        }
    }

    class ElementNode {
        static inputNodeNameList = ['input', 'select', 'textarea'];
        // 获取节点标签类型
        constructor(node) {
            this.isInputNode = ElementNode.inputNodeNameList.includes(node.nodeName.toLowerCase());
            this.node = node;
        }
        // 获取节点
        getNode () {
            return this.node;
        }
    }

    const Vue = function (options) {
        const $options = options;
        const { el, data, template } = $options;
        const element = document.querySelector(el);
        const vm = this;
        vm.$el = element;                       // 挂载的元素
        vm.$data = data;                        // 内容为数据
        vm.$template = template;                // 模板字符串内容
        // 劫持数据对象
        vm.$observer = new Observer(vm);        // 包含观测数据的方法
        // 编译
        vm.$complie = new Compile(vm);          // 包含编译的方法
    };
    global.Vue = Vue;
})(window, document)
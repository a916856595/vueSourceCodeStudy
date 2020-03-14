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
        }
    };

    const regExp = {
        templateString: /{\s*{(.*?)}\s*}/g,     // 匹配单个表达式,包括花括号
        variable: /[a-zA-Z]+(\.?\w)*/,          // 匹配表达式中的变量名称,包括取对象的属性
        expressionUselessPart: /{\s*{|}\s*}/g,  // 匹配单个表达式中的花括号
    };

    class DataMethods {
        constructor(vm) {
            this.data = vm.$data;
        }
        // 获取数据的方法，field是$data的属性名称，以(.)组合
        get (field) {
            return field.split('.').reduce((currentData, fieldName) => {
                return currentData[fieldName];
            }, this.data);
        }
    }

    class Directive {
        static isDirective (node) {

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

        }
        // 对文本节点进行修改
        transformTextNode (vm, node) {
            const resultString = node.textContent
                .replace(regExp.templateString, strMatched => {  // 匹配到所有的{{ }}内容
                    // 去除表达式的花括号
                    const currentExpression = strMatched.replace(regExp.expressionUselessPart, '');
                    // 将表达式中的变量替换为变量值
                    return currentExpression.replace(regExp.variable, variableField => {
                        return vm.$dataMethods.get(variableField);
                    });
                });
            node.textContent = resultString;
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
                    // 在给数据重新赋值的时候，需要检查新值是否为对象，如果是，那么需要观察数据
                    if (utilities.isObject(newValue)) {
                        this.observeObject(newValue);
                    }
                    value = newValue;
                }
            })
        }
    }

    const Vue = function (options) {
        const $options = options;
        const { el, data, template } = $options;
        const element = document.querySelector(el);
        const vm = this;
        vm.$el = element;                       // 挂载的元素
        vm.$data = data;                        // 内容为数据
        vm.$dataMethods = new DataMethods(vm);  // 包含一些操作数据的方法,需要先挂载数据后调用
        vm.$template = template;                // 模板字符串内容
        // 劫持数据对象
        vm.$observer = new Observer(vm);        // 包含观测数据的方法
        // 编译
        vm.$complie = new Compile(vm);          // 包含编译的方法
    };
    global.Vue = Vue;
})(window, document)
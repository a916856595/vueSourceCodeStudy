(function (global) {

    const Utilities = {
        objToStr: Object.prototype.toString,
        // 返回复杂类型字符串
        getObjToStrText (value) {
            return Utilities.objToStr.call(value).slice(8, -1);
        },
        // 判断是否是对象
        isObject (value) {
            return this.getObjToStrText(value) === 'Object';
        }
    }

    class Compile {
        constructor(vm) {
            new Observer().observeObject(vm.$data);
        };
    }

    // 观察数据类
    // TODO 这里需要添加观察数组变化的方法
    class Observer {
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
                    console.log('获取值');
                    return value;
                },
                set: (newValue) => {
                    // 在给数据重新赋值的时候，需要检查新值是否为对象，如果是，那么需要观察数据
                    if (Utilities.isObject(newValue)) {
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
        vm.$el = element;
        vm.$data = data;
        vm.$template = template;
        new Compile(vm);
    };
    global.Vue = Vue;
})(window)
// @flow
const fs = require('fs');
const faker = require('faker');
const path = require('path');
const mockery = require('mockery');
const expr = /<%(.+?)%>/g;

declare type ParsedArgs = {
    type: string,
    name: string
};

declare type ParsedReturns = {
    type: string,
    value: any
};

declare type ParsedFunc = {
    args: ParsedArgs[],
    returns: ParsedReturns
};

module.exports = class MockJSONFactory {
    directory: string;
    modules: Array<{
        path: string,
        name: string,
        submodules: Array<{
            name: string,
            raw: string
        }>
    }>;

    parsed: {
        [module: string]: {
            [submodule: string]: {
                [func: string]: ParsedFunc
            }
        }
    };

    constructor(directory: string) {
        this.modules = [];
        this.directory = directory;
        this.parsed = {};

        this._readDir();
        this._parseModules();
    }

    register() {
        const mocks = this.toMockeryMocks();
        mocks.forEach(mock => {
            mockery.registerMock(mock, mocks[mock]);
        });

        return mocks;
    }

    _readDir() {
        fs.readdirSync(this.directory).forEach(moduleName => {
            const modulePath = path.join(this.directory, moduleName);

            if (fs.lstatSync(modulePath).isDirectory()) {
                this.modules.push({
                    path: modulePath,
                    name: moduleName,
                    submodules: fs.readdirSync(modulePath)
                        .map((e) => path.join(modulePath, e))
                        .filter((filename) => filename.endsWith('.json'))
                        .map((filename) => {
                            const name = path.basename(filename.replace(/\.json$/, ''));
                            const raw = fs.readFileSync(filename).toString();

                            return { raw, name };
                        })
                });
            }
        });
    }

    _parseModules() {
        this.modules.forEach((module) => {
            if (!this.parsed[module.name]) {
                this.parsed[module.name] = {};
            }

            module.submodules.map((submodule) => {
                const replaced = submodule.raw.replace(expr, (...args): string => {
                    let fakeExpr = args[1].trim();
                    if (!fakeExpr.endsWith(')') && !fakeExpr.endsWith(';')) {
                        fakeExpr += '()';
                    }

                    return `faker.${fakeExpr}`;
                });

                const parsed = JSON.parse(replaced);

                this.parsed[module.name][submodule.name] = Object.keys((parsed)).map((funcName) => {
                    const error = (message, ...args) => {
                        throw new Error(`${message} for ${module.name}.${submodule.name}.${funcName}`, ...args);
                    };

                    const func = {
                        args: [],
                        returns: {}
                    };

                    func.returns = this.constructor.parseRet(parsed[funcName].returns);

                    const args = parsed[funcName].args;
                    if (args !== undefined && args !== null) {
                        if (!Array.isArray(args)) {
                            error('args must be an array');
                        } else {
                            func.args = args.map((arg) => this.constructor.parseArg(arg, error));
                        }
                    }

                    return {
                        func,
                        funcName
                    };
                }).reduce((acc, curr) => {
                    acc[curr.funcName] = curr.func;
                    return acc;
                }, {});

            });
        });
    }

    toFlowString() {
        let moduleDef = '';
        let indent = '  ';

        Object.keys(this.parsed).forEach((module) => {
            moduleDef += `declare module "${module}" {\n`;
            moduleDef += `${indent}declare module.exports: {\n`;
            Object.keys(this.parsed[module]).forEach((submodule) => {
                indent += '  ';
                if (submodule !== '_') {
                    moduleDef += `${indent}${submodule}: {\n`;
                    indent += '  ';
                }
                moduleDef += indent + Object.keys(this.parsed[module][submodule]).map((func) => {
                    return `${MockJSONFactory._flowFunc(func, this.parsed[module][submodule][func])}`;
                }).join(`,\n${indent}`);

                indent = indent.slice(0, indent.length - 2);

                if (submodule !== '_') {
                    moduleDef += `\n${indent}},\n`;
                } else {
                    moduleDef += `, \n`;
                }
            });

            indent = indent.slice(0, indent.length - 2);
            moduleDef += `${indent}}\n`;
            moduleDef += `}\n`;
        });

        return moduleDef;
    }

    toMockeryMocks() {
        const reduceFirst = (acc: Object, curr: [string, any]) => {
            acc[curr[0]] = curr[1];

            if (curr[0] === '_') {
                const temp = curr[1];
                Object.assign(temp, acc);
                delete temp['_'];
                return temp;
            }

            return acc;
        };

        return Object.keys(this.parsed).map(moduleName => {
            const module = this.parsed[moduleName];

            const modules = Object.keys(module).map(submoduleName => {
                const submodule = this.parsed[moduleName][submoduleName];

                let submodules = Object.keys(submodule).map(funcName => {
                    const functor = this.parsed[moduleName][submoduleName][funcName];

                    return [
                        funcName,
                        (...args) => {
                            if (args.length !== functor.args.length) {
                                throw new Error(`Wrong number of args; expected ${functor.args.length}, ` +
                                    `got ${args.length} instead.`);
                            }

                            if (`${functor.returns.value}`.startsWith('faker.')) {
                                return eval(functor.returns.value);
                            } else {
                                return functor.returns.value;
                            }
                        }
                    ];
                }).reduce(reduceFirst, {});

                return [submoduleName, submodules];
            }).reduce(reduceFirst, {});

            return [moduleName, modules];
        }).reduce(reduceFirst, {});
    }

    static _flowArg({ type, name }: { type: string, name: string }) {
        return `${name}:${type}`;
    }

    static _flowRet({ type }: { type: string }): string {
        return `: ${type}`;
    }

    static _flowFunc(name: string, func: ParsedFunc) {
        return (name === '_' ? '' : name) +
            `(${func.args.map((arg) => MockJSONFactory._flowArg(arg)).join(', ')})` +
            MockJSONFactory._flowRet(func.returns);
    }

    static parseRet(ret: ParsedReturns) {
        if (ret === undefined || ret === null || ret === '') {
            return {
                type: 'void',
                value: undefined
            };
        } else {
            if (Array.isArray(ret)) {
                const look = ret[0];
                return {
                    type: `${typeof look}[]`.replace(/\[Object object\]/, 'Object'),
                    value: ret
                };
            } else if (Object(ret) === ret) {
                return {
                    type: 'Object',
                    value: ret
                };
            } else {
                return {
                    type: typeof ret,
                    value: ret
                };
            }
        }
    }

    static parseArg(arg: any, error: (string) => void) {
        if (Array.isArray(arg)) {
            return {
                name: arg[0],
                type: arg[1]
            };
        } else if (typeof arg === 'number') {
            throw new Error('Args cannot be numbers silly');
        } else if (Object(arg) === arg) {
            if (arg.type === null || arg.type === undefined || !arg.name) {
                error('arg descriptor objects must have type and name');
            }

            return {
                type: arg.type,
                name: arg.name
            };
        } else {
            const str = `${arg}`;
            if (str.match(/:/)) {
                return {
                    name: str.split(':')[0],
                    type: str.split(':')[1],
                };
            } else {
                return {
                    name: str,
                    type: 'any'
                };
            }
        }
    }
};

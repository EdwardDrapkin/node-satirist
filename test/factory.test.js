const Factory = require('../src/MockJSONFactory');
const path = require('path');
const mockery = require('mockery');
const assert = require('./assert');

function getFactory(name) {
    const factory = new Factory(path.resolve(__dirname, 'test-cases', name, 'mocks'));
    const mocks = factory.toMockeryMocks();

    Object.keys(mocks).forEach(mock => {
        mockery.registerMock(mock, mocks[mock]);
    });
    return factory;
}

suite('MockJSONFactory', () => {
    suiteSetup(() => {
        mockery.enable({ warnOnUnregistered: false });
    });

    suiteTeardown(() => {
        mockery.disable();
    });

    suite('basic function module', () => {
        getFactory('basic');

        test('returns as expected', () => {
            assert(require('basic')() === 'success');
        });

        test('allows properties', () => {
            assert(require('basic').foo() === 'success');
        });

        test('args must be an array of names', () => {
            assert.throws(() => getFactory('broken-def-arg-not-array'));
        });
    });

    suite('multiple modules', () => {
        test('all modules load', () => {
            const factory = getFactory('multiple');
            const flowStr = factory.toFlowString();

            assert(flowStr.match(/\(\): string/));
            assert(flowStr.match(/sub: {/));

            assert(require('multiple')() === 'success');
            assert(require('multiple').foo() === 'success');
            assert(require('multiple').sub.foo() === 'success');
        });
    });

    suite('module with submodules', () => {
        getFactory('submodules');

        test('returns as expected', () => {
            assert(require('submodules').sub() === 'success');
        });
        test('allows properties', () => {
            assert(require('submodules').sub.foo() === 'success');
        });
    });

    suite('faker support', () => {
        getFactory('faker-support');
        test('interpolates', () => {
            assert(require('faker-support')().length === 36);
        });

        test('generates multiple values', () => {
            const fake = require('faker-support');

            assert(fake() !== fake());
        });

        test('invocation parens are optional for no args', () => {
            assert(require('faker-support').noargs().length === 36);
        });
    });

    suite('mockery callbacks', () => {
        getFactory('basic');

        test('enforce arity', () => {
            assert.throws(() => require('basic').foo(1));
        });
    });

    suite('flow support', () => {
        const factory = getFactory('flow-support');
        const flowStr = factory.toFlowString();

        test('Outputs flow with no types provided', () => {
            assert(flowStr.match(/\(\): string/));
            assert(flowStr.match(/foo\(\): string/));
        });

        test('must have a string name', () => {
            const subFlow = getFactory('submodules').toFlowString();

            assert(subFlow.match(/sub: {/));
        });

        suite('args', () => {
            test('must have a string name', () => {
                assert.throws(() => getFactory('broken-flow-numeric-arg'));
            });

            test('outputs as any with no types provided', () => {
                assert(flowStr.match(/argsWithNoTypes\(a:any, b:any, c:any\): string/));
            });
            test('parses types provided a colon', () => {
                assert(flowStr.match(/argsWithColonTypes\(a:string, b:number, c:Object\): string/));
            });
            test('parses types provided an array [name, type]', () => {
                assert(flowStr.match(/argsWithArrayTypes\(a:string, b:number, c:Object\): string/));
            });
            test('parses types provided an object {name, type}', () => {
                assert(flowStr.match(/argsWithObjTypes\(a:string, b:number, c:Object\): string/));
            });
            test('rejects partial objects', () => {
                assert.throws(() => getFactory('broken-flow-partial-arg'));
            });
            test('allows mixing formats', () => {
                assert(flowStr.match(/argsWithMixedTypes\(a:string, b:number, c:Object\): string/));
            });
        });

        suite('returns', () => {
            test('object returns are annotated Object', () => {
                assert(flowStr.match(/complexReturn\(\): Object/));
            });

            test('array types are inferred based on first element', () => {
                assert(flowStr.match(/strArrayReturn\(\): string\[\]/));
            });

            test('allows ()=> void funcs to be annotated', () => {
                assert(flowStr.match(/noArgsOrReturn\(\): void/));
            });
        });
    });

    suite('Promise support', () => {
        test('Resolves instead of returns', () => {
            const factory = getFactory('promises');
            const flowStr = factory.toFlowString();

            assert(flowStr.match(/Promise<string>/));

            assert(require('promise-support')() instanceof Promise);
            return require('promise-support')().then((res) => {
                assert(res === 'success');
            });
        });
    });
});

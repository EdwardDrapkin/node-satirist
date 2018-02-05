# Satirist
Quickly generate mock modules

Ever been in a situation where you needed a functional module that wasn't ready yet?  Whether it's because your coworkers haven't finished up a library, a new 3rd party dependency hasn't been approved yet, or even just for mocking multiple modules for testing, Satirist is here to help you.  With a few JSON files, Satirist can quickly generate you drop-in mock models (using [mockery](https://github.com/mfncooper/mockery)) that are ready to consume for development.  

##  Getting Started

### Installation

    npm install --save-dev satirist
    
or if you prefer

    yarn add -D satirist 
    
### Usage

All you have to do is import the Satirist class, instatiate it with your mocks directory, and register it with mockery.  

In your entrypoint or test setup function:

    const mockery = require('mockery'); // Satirist does NOT enable mockery for you
    const Satirist = require('satirist');
    
    mockery.enable();
    const factory = new Satirist('/your/mocks/dir');
    factory.register();
    
### Mocks directory

The mocks directory follows a fairly simple layout: `mocks/<module>/<export>.json`.

So if you would normally `import {foo} from 'bar'` or `const {foo} = require('bar')`, you would put your json file at `mocks/bar/foo.json`.  If you want to access the default export, use the special identity (`_.json`) file.

Examples:
    
    import {foo} from 'bar'; // mocks/bar/foo.json
    
    const foo = require('foo'); // mocks/foo/_.json
    
    const _ = require('_'); // mocks/_/_.json
    
### JSON layout

The JSON layout is the heart and soul of a Satirist's utility.  The JSON schema at its top level mirrors the export object.  By default, any key is a function with 0 arity and no return.

That is to say that this JSON (at `mocks/foo/bar.json`): 

    {
        "someFunc": {} 
    }
     
Will result in `bar.someFunc()` being registered as a mock on the `foo` module.  If the module exports a function, use the special keyword `_`

Satirist only supports exporting functions on modules.  The full spectrum of possibilities are laid out here:


    {
        "_": {
            // returns is optional and defaults to void
            // you can use the keyword "resolves" instead of "returns" for Promise support
            // args are optional and defaults to 0
        },
       
        // return options
         
        "justAReturn": {
            "returns": 2 // you can return a value directly and the mocks will return it as well
        }
        
        "justAPromise": {
            "resolves": "eventually..."
        }
    
        "arrayReturn": {
            "returns": [2, 3] // if you return an array, the flow definition will assume a single-type array and not try to infer a tuple's signature
        }
       
        "objReturn": {
            "returns": { // more complex types are supported as well
                "foo": "bar"
            }
        }
        
        "fakerReturn": {
            "returns": {
                "foo": "<% random.uuid %>" // see faker support down below
            }
        }
       
        // args options
        
        "emptyArgs": {
            args: [] // if you want to be explicit, you can specify an empty array
        }
        
        "stringArgs": {
            args: ["a", "b"] // each entry in the array is the name of a parameter
        }
        
        "explicitArgs": {
            args: [
                // you can verbosely set the name/type of an argument
                {
                    "name": "a",
                    "type": "YourModel"
                },
                
                // or you can be more implicit
                ["a", "YourModel"],
                
                // or use flow annotations directly
                "a:YourModel"
            ]
        }
    }

### Faker interpolation

Limited "templating" support is available with `<% fakermethod() %>` tags.  You can omit the `faker` (e.g. `<% random.uuid() %>`).

Faker calls will be made at runtime and multiple calls to the same mock will generate new values each time.
### Generating Flow Library definition files

Satirist also supports generating flow lib definition files.  Simply run satirist from the command line:

    yarn -s satirist /your/mocks/here > flow-typed/satirist.js

The type definitions are not perfect but should serve as a good starting point to flesh them out, or at least enough to get you going without losing all type safety.

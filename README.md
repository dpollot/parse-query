parse-query
===========

An angular service that provides a simple abstraction over the [parse](http://www.parse.com) javascript sdk.

## Purpose

The Parse javascript sdk is fantastic and fully featured, however there may be cases where a developer might wish to leverage parse's data directories and restful APIs, while insulating their own application from the sdk.

Instead of spinning up a number of services (service:resource), the ParseQueryService can act as a single service capable of interacting with any resource.

### Prerequisites

The ParseQueryService is an [angular](angularjs.org) service that is built on on top of the Parse javascript sdk.  It makes use of [underscore](underscorejs.org) as well.

### Using the Service

#### Setup
Once you've referenced the javascript, you must include the module in your app's module.
~~~javascript
angular.module('your-app', ['services.parse.query']);
~~~

You'll need to do some minimal bootstrapping to make Parse aware of your resources (classes).  After you've initialized your parse application, you'll register your classes, and provide a mapping from the parse objects to your own. 
~~~javascript
app.run(function(ParseQueryService){
    Parse.initialize("clientkey", "parsejavascriptkey");

    ParseQueryService.registerParseClass('YourClassName', function(pfObject){
    	return {
    		id: pfObject.id,
    		name: pfObject.get("somePropertyName")
    	}
    });

    ParseQueryService.registerParseClass('YourOtherClass', function(pfObject){
        return {
            id: pfObject.id,
            name: pfObject.get("somePropertyName")
        }
    });
});
~~~

If you're not interested in mapping the objects returned from the service to some POJSO (plain old js object), then you could simply return the pfObject passed in, however this does somewhat defeat some of the purpose.

#### Usage
Once you've got this all set up, the rest is pretty straight forward.

The ParseQueryService exposes the following methods:

get(resourceName, id)
query(resourceName, predicate)
save(resourceName, item)
update(resourceName, item)
remove(resourceName, item)

example:
~~~javascript
var thing = {
    foo: "foo",
    bar: "bar",
    complexObject: {
        foobar: "there are rules for pooping at work",
        rules: ["last resort", "be discrete"]
    }
}
ParseQueryService.save("Thing", thing);
~~~

Each of these methods returns an angular promise, I swear.

##### Querying
Querying deserves a bit more discussion, simply because it provides the ability to pass in a predicate.  The predicate must follow a particular format:
~~~javascript
    {
		type: 'expression',
		expression:{
			type: 'and' | 'or',
			predicates: []
		}
	}
	// or
	{
		type: 'constraint',
		constraint:{
			whereKey: 'somePropertyName',
			operator: '[]',
			operand: {}
		}
	}
~~~

There are two types of predicates, expressions and constraints.
Constraints contain the property name, an operator, and an operand.  Take a look at the parse query documenation for a list of the available operators.

Expressions either 'and', or 'or' other predicates (which, as mentioned above, can be expressions or constraints).

The ParseQueryService will translate your predicate (so long as it conforms to the above) into a Parse query, and the query method will return the results that match that predicate.

In order to construct the predicate, there's a handy angular service I've written, which can be found here.



angular.module('services.parse.query', ['services.predicates.parse']).factory('ParseQueryService', ['$q', '$window', 'ParsePredicateProvider',
function($q, $window, ParsePredicateProvider) {

	/*	This should be configured by the consumer */
	var ParseObjectFactory = {

		create: function(resourceName){
			return new $window[resourceName];
		}
	}

	/*
		Contains a mapping between resources and their associated mappers.
		This should be configured by the consumer through the registerMap method.
	*/
	var map = {

	}

	var mapToInternal = function(resourceName, parseObj){
		var mappingDelegate = map[resourceName];
		var internal = mappingDelegate(parseObj);
		return internal;
	};

	var mapFromInternal = function(resourceName, internalObj){
		var external = ParseObjectFactory.create(resourceName);
			
		_.each(_.pairs(internalObj), function(kvPair){
			if(kvPair[0] != 'createdBy')
				external.set(kvPair[0], kvPair[1]);
			else{
				var u = new Parse.User();
				u.id = internalObj.createdBy.id;
				external.set("createdBy", u);
			}
		});

		return external;
	};



	return {
		/*	register a class with a mapper
			className: the name of the parse class
			delegate: a delegate having the form
				function(pfObject){
					return {
						prop: pfObject.get("propertyName");
					}
				} 
		*/
		registerParseClass: function(className, mapper){
			$window[className] = Parse.Object.extend(className);
			map[className] = mapper;
		},

		/*  
			Query for the given resource name,
			with the given predicate
		*/
		query: function(resourceName, predicate){
			var deferred = $q.defer();
			
			var query = undefined !== predicate ? ParsePredicateProvider.buildQuery(resourceName, predicate) : new Parse.Query(resourceName);

			query.find({
				success: function(results){
					deferred.resolve(_.map(results, function(r){ return mapToInternal(resourceName, r); }));
				},
				error: function(obj, error){
					deferred.reject();
				}
			});

			return deferred.promise;
		},
		/*	
			returns an object for the given resource name matching the given id
		*/
		get: function(resourceName, id){
			var deferred = $q.defer(),

			query = new Parse.Query(resourceName);

			query.get(id, {
				success: function(result){
					deferred.resolve(mapToInternal(resourceName, result));
				},
				error: function(obj, error){
					deferred.reject(error.description);
				}
			});

			return deferred.promise;
		},
		/* 
			Creates a new object for the given resource
		*/
		save: function(resourceName, item){
			var deferred = $q.defer();

			mapFromInternal(resourceName, item)
				.save(null, {
					success: function(inserted){
						item.id = inserted.id;
						deferred.resolve(item);
					},
					error: function(obj, error){
						deferred.reject(error.description);
					}
				});
			
			return deferred.promise;
		},
		/*
			Updates the object for the given resource name
		*/
		update: function(resourceName, item){
			var deferred = $q.defer();

			var parseObject = mapFromInternal(resourceName, item);
			parseObject.save({
				success: function(updated){
					deferred.resolve();
				},
				error: function(obj, error){
					deferred.reject(error.description);
				}
			});

			return deferred.promise;
		},
		/*
			Removes the given object from the given resource
		*/
		remove: function(resourceName, item){
			var deferred = $q.defer();

			mapFromInternal(resourceName, item)
				.destroy({
					success: function(deleted){
						deferred.resolve();
					},
					error: function(obj, error){
						deferred.reject(error.description);
					}
				});

			return deferred.promise;
		}
	};
}]);

angular.module('services.predicates.parse', []).provider('ParsePredicateProvider', function(){
	var PredicateParser = {
		// Parse the given constraint
		// 
		parseConstraint: function(constraint, forQuery){
			switch(constraint.operator){
				case 'equalTo':
					forQuery.equalTo(constraint.whereKey, constraint.operand);
					break;
				case 'notEqualTo':
					forQuery.notEqualTo(constraint.whereKey, constraint.operand);
					break;
				case 'containedIn':
					forQuery.containedIn(constraint.whereKey, constraint.operand);
					break;
				case 'contains':
					forQuery.contains(constraint.whereKey, constraint.operand);
					break;
				case 'containsAll':
					forQuery.containsAll(constraint.whereKey, constraint.operand);
					break;
				case 'lessThan':
					forQuery.lessThan(constraint.whereKey, constraint.operand);
					break;
				case 'greaterThan':
					forQuery.greaterThan(constraint.whereKey, constraint.operand);
					break;
			}
			return forQuery;
		},

		parseAndExpression: function(expression, forQuery){
			var self = this;

			// do we have any 'or predicates within the list of predicates?
			var orPredicates = _.filter(expression.predicates, function(p){ return p.type == 'expression' && p.expression.type == 'or'; });

			if(undefined != orPredicates && orPredicates.length > 0){
				// Within our list of predicates to logically 'and' together, we've got at least one 'or'.
				// right now, i don't think parse supports the logical and of two ors.
				if(orPredicates.length > 1){
					throw "Parse does not currently support the logical 'and' of two 'or's.  Sorry dude.";
				}
				
				var pred = orPredicates[0];
				var orQuery = self.buildQuery(forQuery.className, pred);

				_.chain(expression.predicates).filter(function(p){ return p != pred }).each(function(p){
					self.parsePredicate(p, orQuery);
				});

				return orQuery;
			} else {
				// We are straight up logically anding constraints
				_.each(expression.predicates, function(p){
					self.parsePredicate(p, forQuery);
				})
				return forQuery;
			}
		},

		parseOrExpression: function(expression, forQuery){
			var self = this;
			// expression is 'or'
			var queries = [];
			_.each(expression.predicates, function(predicate){
				queries.push(self.buildQuery(forQuery.className, predicate));
			})
			var orQuery = Parse.Query.or.apply(self, queries);
			return orQuery;
		},

		parseExpression: function(expression, forQuery){
			var self = this;
			if(expression.type == 'and'){
				return self.parseAndExpression(expression, forQuery);
			}else{
				return self.parseOrExpression(expression, forQuery);
			}
		}, 

		parsePredicate: function(predicate, forQuery){
			// we've got two choices, constraint or expression
			if(predicate.type == 'constraint'){
				return this.parseConstraint(predicate.constraint, forQuery);
			} else {
				return this.parseExpression(predicate.expression, forQuery);
			}
		},

		buildQuery: function(resourceName, predicate){
			var query = new Parse.Query(resourceName);
			var createdQuery = this.parsePredicate(predicate, query);

			return createdQuery;
		}
	};

	return {
		$get: function(){
			return {
				buildQuery: function(resourceName, predicate){
					return PredicateParser.buildQuery(resourceName, predicate);
				}
			}
		}
	}
})

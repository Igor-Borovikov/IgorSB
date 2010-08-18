// Diff from base planner is that a member function can check 
// if pre-condition holds using a function (see conditionHolds)
//
// Terminology:
// - state is just a dictionary or an object; here it is 
//   derived from a JS function object
var Planner = function(){
    // Stateless planner, doesn't save any of the intermediate 
    // results internally, can be reused without reset.
    return {
        // Create prototype-based descendat of the object
        newFrom : function(obj){
            var F = function () {};
            F.prototype = obj;
            return new F();
        },

        // Append properties of obj to dst
       appendTo : function(dst, obj){
            for (name in obj){
                dst[name] = obj[name];
            };
            return dst;
        },

        // Merge states provided in an array into a single state
        mergeStates : function(arrOfStates){
            var n = 0, flatState = {};
            for (n=0; n<arrOfStates.length; n++){
                flatState = this.appendTo(flatState, arrOfStates[n]);
            };
            return flatState;
        },

        // Check if the property name must be skipped in matching conditions
        mustMatchName : function(name){
            var ignorableNames = ["prevState", "balance", "age", "transName", "live"];
            var n;
            for (n = 0; n<ignorableNames.length; n++){
                if (name == ignorableNames[n]) return false;
            };
            return true;
        },

        // Check if condB satisfies all conditions in condA, i.e. A is subset of B
        isSubset : function(condA, condB){
            for (name in condA){
                if (this.mustMatchName(name)) {
                    if (condA[name] != condB[name]) return false;
                }
            };
            return true;
        },
        
        // Allows condition to check if it holds for the given state using function instead of subset check 
        conditionHolds : function(cond, state){
            return typeof(cond) === 'function' ? cond(state) : this.isSubset(cond, state);
        },

        // Increment balance and age: make it a method of state!
        updateBalance : function(state, cost){
            if (state.balance) state.balance += cost;
            else state.balance = cost;
                
            if (state.age) state.age += 1;
            else state.age = 1;
        },

        // Apply post-condition from transiontion to the state
        applyPostCondition : function(state, transition) { 
            if (typeof(transition.postCond) === 'function'){
                // this call is responsible for updating transition name and balance
                transition.postCond(state); 
            }
            else {
                for (name in transition.postCond){
                    if (this.mustMatchName(name)) { 
                        state[name] = transition.postCond[name];
                    };
                };
                state.transName = transition.transName;
                this.updateBalance(state, transition.cost);
            };
        },

        // Attempt to generate derived state using transition
        nextState : function(state, transition){ 
            if (this.conditionHolds(transition.preCond, state)){
                var newState = this.newFrom(state);
                this.applyPostCondition(newState, transition); 
                newState.prevState = state;
                newState.live = true;
                return newState;
            };
            return null;
        },

        // Single interation of solver attempts to generate new unique states
        iterateStates : function(visitedStates, transitions, goal){
            var n, m, i;
            var nVisited = visitedStates.length;
            for (n = 0; n < nVisited; n++){
                var currState = visitedStates[n];
                // ignore states that failed to spawn derived states on the previous iteration:
                if (!currState.live) continue;
                currState.live = false;
                
                startNextTransition: 
                for (i = 0; i<transitions.length; i++){
                    var newState = this.nextState(currState, transitions[i]); 
                    if (newState){
                        // check if the derivded state is not already covered by one of the existing states
                        for (m=0; m < visitedStates.length; m++){
                            // here we specifically check for subset not conditionHolds 
                            // as we want all possible states to be generated in breadth first search
                            if (    this.isSubset(visitedStates[m], newState) 
                                 && visitedStates[m].balance <= newState.balance)
                                break startNextTransition;
                        };
                        
                        // we found new unique derived state, mark the parent as active and save the new state
                        currState.live = true;
                        visitedStates.push(newState);
                        
                        // check if we are done by applying (potentially) procedural criteria conditionHolds
                        // instad of more direct isSubset check
                        if (this.conditionHolds(goal, newState))
                            return newState;
                    };
                };
            };
            return null;
        },

        // Run interations while goal is not found or maxIters limit not reached
        solvePlan : function(states, transitions, goal, maxIters){
            var res = null;
            var flatState = this.mergeStates(states);
            flatState.live = true;
            var visitedStates = [flatState];
            var iter = 0;
            while (res == null && iter < maxIters){
                res = this.iterateStates(visitedStates, transitions, goal);
                iter += 1;
            };
            return res;
        }
    };
};

var getTransitionsOnly = function(state){
    var trans = [state.transName];
    var currState = state.prevState;
    while (currState && currState.transName){
        trans.push(currState.transName);
        currState = currState.prevState;
    };
    trans.reverse();
    return "Transitions: "+JSON.stringify(trans);
};

//-----------------------------------------------------
// Module test:
//-----------------------------------------------------

var testPlanner1 = function(){
    logger("-----------Solving goat, cabbage and wolf problem---------", 0, 2);
    
    // initial state
    var world = {
        "goat.location" : "left",
        "cabbage.location" : "left",
        "wolf.location" : "left",
        "boat.location" : "left",
        "boat.cargo" : null
    };

    // goal
    var goal = {
        "goat.location" : "right",
        "wolf.location" : "right",
        "cabbage.location" : "right"
    };
    
    // transitions:
    var embarkTransition = function(agent){
        var transition = {
            "transName" : "[embark-"+agent+"]",
            "cost" : 1,
            "preCond" : function(state) {
                return state[agent+".location"] == state["boat.location"] && !state["boat.cargo"];
            },
            "postCond" : function(state) {
                state[agent+".location"] = "boat";
                state["boat.cargo"] = agent;
                this.commonUpdate(state);
            },
            commonUpdate : function (state){
                if (state.balance) state.balance += this.cost;
                else state.balance = this.cost;
                if (state.age) state.age += 1;
                else state.age = 1;
                state.transName = this.transName;
            }
        };
        return transition;        
    };
    
    var embarkGoat = embarkTransition("goat");
    var embarkCabbage = embarkTransition("cabbage");
    var embarkWolf = embarkTransition("wolf");
    
    var crossRiver = {
        "transName" : "[cross]",
        "cost" : 1,
        "preCond" : function(state){
            // can't cross if two remaining agents are not safe together
            if (state["goat.location"] == state["wolf.location"]) return false;
            if (state["goat.location"] == state["cabbage.location"]) return false;
            return true;
        },
        
        "postCond" : function(state){
            // assign side to the cargo, if any, empty the boat, assign side to boat
            var agent = state["boat.cargo"];
            if (agent) {
                state[agent+".location"] = this.flipLocation(state["boat.location"]);
            };
            state["boat.location"] = this.flipLocation(state["boat.location"]);
            state["boat.cargo"] = null;
            this.commonUpdate(state);
        },
        
        commonUpdate : function (state){
            if (state.balance) state.balance += this.cost;
            else state.balance = this.cost;
            if (state.age) state.age += 1;
            else state.age = 1;
            state.transName = this.transName;
        },
            
        flipLocation : function(loc){ // helper function
            return loc=="right" ? "left" : "right";
        }
    };

   
    var transitions = [ embarkGoat, embarkCabbage, embarkWolf, crossRiver ];
    
    var planner = new Planner();
    var solution = planner.solvePlan([world], transitions, goal, 20);
    logger(JSON.stringify(solution), 0, 1);
    
    logger(getTransitionsOnly(solution), 0, 1);
};

/*
var testPlanner1 = function(){
    logger("-----------Solving for opening door---------", 0, 2);

    var stateAgentNoKey = {
        "agent.hasKey": 0
    };
    
    var stateGuardHasKey = {
        "guard.hasKey" : 1
    };

    var stateAgentGotKey = {
        "agent.hasKey": 1
    };
    
    var stateDoorLocked = {
        "door.isLocked" : 1
    };
    
    var stateDoorUnlocked = {
        "door.isLocked" : 0
    };
    
    var askForKey = {
        "transName" : "[ask for key]",
        "cost" :  1,
        "preCond" : {"guard.hasKey" : 1},
        "postCond" : {"agent.hasKey" : 1, "guard.hasKey" : 0}
    };
    
    var unlockDoor = {
        "transName" : "[unlock door]",
        "cost" : 1,
        "preCond" : function(state){
            return state["agent.hasKey"] > 0;
        },
        "postCond" : stateDoorUnlocked
    };
   
    var states = [ stateAgentNoKey, stateGuardHasKey, stateDoorLocked ];
    var transitions = [ askForKey, unlockDoor];
    var goal = stateDoorUnlocked;
    
    var planner = new Planner();
    var solution = planner.solvePlan(states, transitions, goal, 10);
    logger(JSON.stringify(solution), 0, 1);
};

*/

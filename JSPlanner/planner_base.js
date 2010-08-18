// Terminology:
// - state is just a dictionary or an object; here it is 
//   derived from a function object
//
var Planner = function(){
    // Stateless planner, doesn't save any of the intermediate 
    // results internally, can be reused without reset.
    return {
        // Create prototype-based descendat of the object
        newFrom : function(obj){
            // Provide prototype-based cloning. It is more efficient 
            // than manual copy of the object properties.    
            // (see beget function in Douglas Crockford 
            // "JavaScript - The Good parts")
            // We chose here not to pollute Object with new methods and 
            // keep functionality local to the planner.
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

        // Increment balance and age
        updateBalance : function(state, cost){
            if (state.balance) state.balance += cost;
            else state.balance = cost;
                
            if (state.age) state.age += 1;
            else state.age = 1;
        },

        // Apply post-condition from transiontion to the state
        applyPostCondition : function(state, transition) { 
            for (name in transition.postCond){
                if (this.mustMatchName(name)) { 
                    state[name] = transition.postCond[name];
                };
            };
            state.transName = transition.transName;
            this.updateBalance(state, transition.cost);
        },

        // Attempt to generate derived state using transition
        nextState : function(state, transition){ 
            if (this.isSubset(transition.preCond, state)){
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
                if (!currState.live) continue;
                currState.live = false;
                
                startNextTransition: 
                for (i = 0; i<transitions.length; i++){
                    var newState = this.nextState(currState, transitions[i]); 
                    if (newState){
                        for (m=0; m < visitedStates.length; m++){
                            if (this.isSubset(visitedStates[m], newState) && visitedStates[m].balance <= newState.balance)
                                break startNextTransition;
                        };
                        currState.live = true;
                        visitedStates.push(newState);
                        if (this.isSubset(goal, newState))
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

//-----------------------------------------------------
// Module test:
//-----------------------------------------------------
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
        "preCond" : {"agent.hasKey" : 1},
        "postCond" : stateDoorUnlocked
    };
   
    var states = [ stateAgentNoKey, stateGuardHasKey, stateDoorLocked ];
    var transitions = [ askForKey, unlockDoor];
    var goal = stateDoorUnlocked;
    
    var planner = new Planner();
    var solution = planner.solvePlan(states, transitions, goal, 10);
    logger(JSON.stringify(solution), 0, 1);
};



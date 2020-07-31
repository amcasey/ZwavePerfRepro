import { ActionObject, AssignAction, EventObject } from "xstate";

interface DummyContext {
}

interface Event1 {
    type: "evt1";
}

interface Event2 {
    type: "evt2";
}

type Action<TContext, TEvent extends EventObject> =
    | ActionObject<TContext, TEvent>
    | AssignAction<TContext, TEvent>; // NB: extends ActionObject<TContext, TEvent>

declare const action1: AssignAction<DummyContext, Event1>;
const action2: Action<DummyContext, Event1 | Event2> = action1;
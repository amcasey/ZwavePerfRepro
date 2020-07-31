import { AssignAction, TransitionConfig } from "xstate";

interface DummyContext {
}

interface Event1 {
    type: "evt1";
}

interface Event2 {
    type: "evt2";
}

declare const myAction: AssignAction<DummyContext, Event1>

const _on: TransitionConfig<DummyContext, Event1 | Event2> = {
    actions: [myAction],
};
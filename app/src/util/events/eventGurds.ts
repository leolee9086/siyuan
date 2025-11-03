export const isKeybord =(event:Event):event is KeyboardEvent=>{
    return event instanceof KeyboardEvent
}

export const isInputEvent =(event:Event):event is InputEvent=>{
    return event instanceof InputEvent
}

export const isComposing=(event:Event)=>{
    return (isKeybord(event) || isInputEvent(event)) && event.isComposing
}
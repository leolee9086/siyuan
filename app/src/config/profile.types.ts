export interface Profile<T = any> {
    id: string;
    name: string;
    data: T;
}

export interface NamespaceState {
    activeProfileId: string;
}

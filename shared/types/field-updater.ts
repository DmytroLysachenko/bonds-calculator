/** A field/value pair stays correlated at the component boundary. */
export type FieldUpdater<T extends object> = <K extends keyof T>(key: K, value: T[K]) => void;

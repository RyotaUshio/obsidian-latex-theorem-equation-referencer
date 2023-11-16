export function splitIntoLines(text: string): string[] {
    // https://stackoverflow.com/a/5035005/13613783
    return text.split(/\r?\n/);
}

export function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

export function removeFrom<Type>(item: Type, array: Array<Type>) {
    return array.splice(array.indexOf(item), 1);
}

export function insertAt<Type>(array: Array<Type>, item: Type, index: number) {
    array.splice(index, 0, item);
}

export function pathToName(path: string): string {
    return path.slice(path.lastIndexOf('/') + 1);
}

export function pathToBaseName(path: string): string {
    const name = pathToName(path);
    const index = name.lastIndexOf('.');
    if (index >= 0) {
        return name.slice(0, index);
    }
    return name;
}

// https://stackoverflow.com/a/50851710/13613783
export type BooleanKeys<T> = { [k in keyof T]: T[k] extends boolean ? k : never }[keyof T];
export type NumberKeys<T> = { [k in keyof T]: T[k] extends number ? k : never }[keyof T];

// https://www.typescriptlang.org/docs/handbook/mixins.html#alternative-pattern
export function applyMixins(derivedCtor: any, constructors: any[]) {
    constructors.forEach((baseCtor) => {
        Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
            Object.defineProperty(
                derivedCtor.prototype,
                name,
                Object.getOwnPropertyDescriptor(baseCtor.prototype, name) ||
                Object.create(null)
            );
        });
    });
}
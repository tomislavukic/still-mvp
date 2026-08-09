export default class Warranty {

    constructor(data = {}) {

        this.active = Boolean(data.active);

        this.start = data.start ?? null;

        this.end = data.end ?? null;

        this.provider = data.provider ?? "";

        this.type = data.type ?? "";

    }

}

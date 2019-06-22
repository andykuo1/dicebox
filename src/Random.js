class Random
{
    constructor(seed = 0)
    {
        this.setSeed(seed);
    }

    setSeed(seed)
    {
        this.seed = seed % 2147483647;
        if (this.seed <= 0) this.seed += 2147483646;
        this._nextSeed = this.seed;
    }

    next()
    {
        return this._nextSeed = this._nextSeed * 16807 % 2147483647;
    }

    nextFloat()
    {
        return (this.next() - 1) / 2147483646;
    }

    nextInt(min, max)
    {
        return (this.next() % (max - min)) + min;
    }
}

export default Random;
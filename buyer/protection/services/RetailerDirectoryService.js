const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname,'../data');

class RetailerDirectoryService {

    constructor() {
        this.cache = new Map();
    }

    loadMarket(market){

        market = market.toLowerCase();

        if(this.cache.has(market))
            return this.cache.get(market);

        const file = path.join(DATA_DIR,market+'.json');

        if(!fs.existsSync(file))
            return [];

        const retailers =
            JSON.parse(fs.readFileSync(file,'utf8')).retailers || [];

        this.cache.set(market,retailers);

        return retailers;
    }

    all(){

        return ['hr','de','at','si','it','us','eu']
            .flatMap(m=>this.loadMarket(m));

    }

    search(query){

        query=query.toLowerCase();

        return this
            .all()
            .filter(r=>
                r.name.toLowerCase().includes(query) ||
                r.id.toLowerCase().includes(query)
            );

    }

    market(code){

        return this.loadMarket(code);

    }

}

module.exports=new RetailerDirectoryService();

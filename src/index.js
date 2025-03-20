import Card from './Card.js';
import Game from './Game.js';
import TaskQueue from './TaskQueue.js';
import SpeedRate from './SpeedRate.js';

class Creature extends Card {
    constructor(name, maxPower, image) {
        super(name, maxPower, image);
    }

    getDescriptions() {
        return [getCreatureDescription(this), ...super.getDescriptions()];
    }

    get currentPower() {
        return this._currentPower;
    }

    set currentPower(value) {
        this._currentPower = Math.min(value, this.maxPower);
    }
}

class Duck extends Creature {
    constructor() {
        super("Мирная утка", 2);
    }

    quacks() {
        console.log('quack');
    }

    swims() {
        console.log('float: both;');
    }
}

class Dog extends Creature {
    constructor(name = "Пес-бандит", maxPower = 3) {
        super( name, maxPower, name);
    }
}

class Trasher extends Dog{
    constructor() {
        super("Громила", 5);
    }
    modifyTakenDamage(value, fromCard, gameContext, continuation) {
        this.view.signalAbility(() => {
            continuation(value - 1);
        });
    }
}

class Gatling extends Creature{
    constructor() {
        super("Гатлинг", 6);
    }
    attack(gameContext, continuation){
        const taskQueue = new TaskQueue();
        const {oppositePlayer, position} = gameContext;

        taskQueue.push(onDone => this.view.showAttack(onDone));

        oppositePlayer.table.forEach((card, index) => {
            taskQueue.push(onDone => {
                this.dealDamageToCreature(2, card, gameContext, onDone);
            });
        });
        taskQueue.continueWith(continuation);
    }
}

class Lad extends Dog{
    constructor() {
        super("Браток", 2);
    }
    static getInGameCount() {
        return this.inGameCount || 0; 
    }
    
    static setInGameCount(value) { 
        this.inGameCount = Math.max(value, 0); 
    }


    static getBonus() {
        return this.getInGameCount() * (this.getInGameCount() + 1) / 2;
    }

    doAfterComingIntoPlay(gameContext, continuation) {
        Lad.setInGameCount(Lad.getInGameCount() + 1);
        super.doAfterComingIntoPlay(gameContext, continuation);
    }

    doBeforeRemoving(continuation) {
        Lad.setInGameCount(Lad.getInGameCount() - 1);
        super.doBeforeRemoving(continuation);
    }

    modifyDealedDamageToCreature(value, toCard, gameContext, continuation) {
        continuation(value + Lad.getBonus());
    }

    modifyTakenDamage(value, fromCard, gameContext, continuation) {
        continuation(Math.max(value - Lad.getBonus(), 0));
    }

    getDescriptions() {
        const descriptions = [];
        if (Lad.prototype.hasOwnProperty('modifyDealedDamageToCreature') ||
            Lad.prototype.hasOwnProperty('modifyTakenDamage')) {
            descriptions.push('Чем их больше, тем они сильнее');
        }
        return [...descriptions, ...super.getDescriptions()];
    }
}

class Rogue extends Creature {
    constructor() {
        super("Изгой", 2);
    }

    doBeforeAttack(gameContext, continuation) {
        const {oppositePlayer, position, updateView} = gameContext;
        const target = oppositePlayer.table[position];

        if (target) {
            this.stealAbilitiesFrom(target, gameContext);
            updateView();
        }

        continuation();
    }

    stealAbilitiesFrom(target, gameContext) {
        const targetProto = Object.getPrototypeOf(target);
        const abilities = ['modifyDealedDamageToCreature', 'modifyDealedDamageToPlayer', 'modifyTakenDamage'];
        abilities.forEach(ability => {
            if (targetProto.hasOwnProperty(ability)) {
                this[ability] = targetProto[ability].bind(this);
                delete targetProto[ability];
            }
        });
        this.stealFromSameType(targetProto, gameContext);
    }

    stealFromSameType(targetProto, gameContext) {
        const {currentPlayer, oppositePlayer} = gameContext;
        const allCards = [...currentPlayer.table, ...oppositePlayer.table];
        allCards.forEach(card => {
            if (card && card !== this && Object.getPrototypeOf(card) === targetProto) {
                const proto = Object.getPrototypeOf(card);
                ['modifyDealedDamageToCreature', 'modifyDealedDamageToPlayer', 'modifyTakenDamage'].forEach(ability => {
                    if (proto.hasOwnProperty(ability)) {
                        delete proto[ability];
                    }
                });
            }
        });
    }

    getDescriptions() {
        const hasAbilities = ['modifyDealedDamageToCreature', 'modifyDealedDamageToPlayer', 'modifyTakenDamage']
            .some(ability => this.hasOwnProperty(ability));

        const descriptions = [];
        if (hasAbilities) {
            descriptions.push('Похищает способности карт');
        }
        return [...descriptions, ...super.getDescriptions()];
    }
}

class Brewer extends Duck {
    constructor() {
        super("Пивовар", 2);
    }

    doBeforeAttack(gameContext, continuation) {
        const {currentPlayer, oppositePlayer, updateView} = gameContext;
        const allCards = [...currentPlayer.table, ...oppositePlayer.table];
        allCards.forEach(card => {
            if (isDuck(card)) {
                card.maxPower += 1;
                card.currentPower += 2;
                card.view.signalHeal(() => {
                    card.updateView();
                });
            }
        });
        updateView();
        continuation();
    }
    getDescriptions() {
        return ['Усиливает всех уток', ...super.getDescriptions()];
    }
}

class PseudoDuck extends Dog{
    constructor() {
        super("Псевдоутка", 3);
    }

    quacks() {
        console.log('quack');
    }

    swims() {
        console.log('float: both;');
    }
}

class Nemo extends Creature {
    constructor() {
        super("Немо", 4);
    }
    doBeforeAttack(gameContext, continuation) {
        const {oppositePlayer, position, updateView} = gameContext;
        const target = oppositePlayer.table[position];
        if (target) {
            const stolenProto = Object.getPrototypeOf(target);
            Object.setPrototypeOf(this, stolenProto);
            if (typeof stolenProto.doBeforeAttack === 'function') {
                stolenProto.doBeforeAttack.call(this, gameContext, () => {
                    updateView();
                    continuation();
                });
            } else {
                updateView();
                continuation();
            }
        } else {
            continuation();
        }
    }
    getDescriptions() {
        return [...super.getDescriptions()];
    }
}


// Отвечает является ли карта уткой.
function isDuck(card) {
    return card && card.quacks && card.swims;
}

// Отвечает является ли карта собакой.
function isDog(card) {
    return card instanceof Dog;
}

// Дает описание существа по схожести с утками и собаками
function getCreatureDescription(card) {
    if (isDuck(card) && isDog(card)) {
        return 'Утка-Собака';
    }
    if (isDuck(card)) {
        return 'Утка';
    }
    if (isDog(card)) {
        return 'Собака';
    }
    return 'Существо';
}



// Колода Шерифа, нижнего игрока.
const seriffStartDeck = [
    new Nemo(),
];
const banditStartDeck = [
    new Brewer(),
    new Brewer(),
];


// Создание игры.
const game = new Game(seriffStartDeck, banditStartDeck);

// Глобальный объект, позволяющий управлять скоростью всех анимаций.
SpeedRate.set(1);

// Запуск игры.
game.play(false, (winner) => {
    alert('Победил ' + winner.name);
});

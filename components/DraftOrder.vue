<template>
    <div id="list-demo">
        <div v-if="!shuffled">
            <center>
                <button button type="button" class="btn btn-danger" v-on:click="shuffle">Shuffle Picks</button>
            </center>
            
        </div>
        <div v-else-if="shuffled">
            <center>
                <button button type="button" class="btn btn-primary" v-on:click="append" v-if="position != 1">Next Pick</button>
            </center>
            <transition-group name="list" tag="p">
                <li v-for="team in disp" v-bind:key="team" class="list-item">
                    {{ team }}
                </li>
            </transition-group>
        </div>
    </div>
</template>

<script>

export default {
    data() {
        return{
            order: ["Mamoon",
                    "David",
                    "Samson",
                    "Evan",
                    "Malcolm",
                    "Moses",
                    "Ethan",
                    "Kyle",
                    "Matt Jones",
                    "Juan"],
            disp: [],
            currentPick: 1,
            position: 11,
            shuffled: false
        };
    }, 

    methods: {
        shuffle: function() {
            this.order = this.order.map(value => ({ value, sort: Math.random() })).sort((a, b) => a.sort - b.sort).map(({ value }) => value);
            this.shuffled = true;
        },

        append: function() {
            this.disp = this.order.slice(-this.currentPick);
            this.currentPick += 1;
            this.position -= 1;
            if (this.disp.length = 10){
                this.complete = true;
            }
        }
    },
};
</script>

<style>
body{
	font-family: monaco, monospace;
    font-size: 6mm;
}

*{
	padding: 0;
	margin: 0;
	box-sizing:border-box;
}

li{
	list-style-type: none;
    padding-bottom: 20px
}

.list-item {
  margin-right: 10px;
}
.list-enter-active, .list-leave-active {
  transition: all 1.5s;
}
.list-enter, .list-leave-to /* .list-leave-active below version 2.1.8 */ {
  opacity: 0;
  transform: translateX(30px);
}
</style>

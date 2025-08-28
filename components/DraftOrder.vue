<template>
    <div id="list-demo">
      <div v-if="!shuffled">
        <center>
          <button type="button" class="btn btn-danger" @click="shuffle">Shuffle Picks</button>
        </center>
      </div>
  
      <div v-else>
        <center>
          <button type="button" class="btn btn-primary" @click="append" v-if="position != 1">Next Pick</button>
        </center>
  
        <transition-group name="list" tag="p">
          <li v-for="team in disp" :key="team" class="list-item">
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
        order: ["Mamoon","David","Samson","Evan","Malcolm","Moses","Ethan","Kyle","Matt Jones","Juan"],
        disp: [],
        currentPick: 1,
        position: 11,
        shuffled: false,
        complete: false
      };
    }, 
  
    methods: {
      shuffle() {
        this.order = this.order
          .map(value => ({ value, sort: Math.random() }))
          .sort((a, b) => a.sort - b.sort)
          .map(({ value }) => value);
        this.shuffled = true;
      },
  
      append() {
        this.disp = this.order.slice(-this.currentPick);
        this.currentPick += 1;
        this.position -= 1;
        if (this.disp.length === 10) {
          this.complete = true;
        }
      }
    },
  };
  </script>
  
<style scoped>
  /* Keep styles local to DraftOrder to avoid global side-effects */
  li{
    list-style-type: none;
    padding-bottom: 20px
  }
  .list-item { margin-right: 10px; }
  .list-enter-active, .list-leave-active { transition: all 1.5s; }
  .list-enter, .list-leave-to { opacity: 0; transform: translateX(30px); }
  </style>
  

<template>
    <section>
        <div>
            <br />
            <Contacts />
            <br />
        </div>
    </section>
</template>

<script>
import Contacts from '~/components/Contacts.vue'
export default {
    components: {
        Contacts
    }
}
</script>

<style>
.container {
  margin: auto;
  display: flex;
  min-height: 100vh;
  text-align: center;
}

.title {
  font-family: monaco, monospace;
  display: flow-root;
  font-weight: 300;
  font-size: 6vw;
  color: #35495e;
  word-spacing: -1.5vw;
  letter-spacing: 1px;
  text-align: center;
}

.subtitle {
  font-family: monaco, monospace;
  display: flow-root;
  font-weight: 300;
  font-size: 3vw;
  color: #526488;
  word-spacing: -0.5vw;
  padding-bottom: 15px;
  text-align: center;
}

.links {
  padding-top: 15px;
  font-family: monaco, monospace;
}
</style>
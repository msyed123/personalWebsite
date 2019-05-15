<template>
  <section class="container">
    <div>
      <Logo />
      <h1 class="title">
        Mamoon Syed
      </h1>
      <h2 class="subtitle">
        Aerospace Engineer
      </h2>
      <div class="links">
        <b-button variant="outline-primary" v-bind:to="{path: 'about'}">
          About
        </b-button>
        <b-button variant="outline-primary" v-bind:to="{path: 'projects'}">
          Projects
        </b-button>
        
      </div>
    </div>
  </section>
</template>

<script>
import Logo from "~/components/Logo.vue";

export default {
  components: {
    Logo
  }
}
</script>

<style>
.container {
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.title {
  font-family: monaco, monospace;
  display: block;
  font-weight: 300;
  font-size: 10vw;
  color: #35495e;
  letter-spacing: 1px;
}

.subtitle {
  font-family: monaco, monospace;
  font-weight: 300;
  font-size: 5vw;
  color: #526488;
  word-spacing: 5px;
  padding-bottom: 15px;
}

.links {
  padding-top: 15px;
  font-family: monaco, monospace;
}
</style>

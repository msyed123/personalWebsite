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
        <div class="btn-group">
          <b-button variant="outline-primary" v-bind:to="{path: 'about'}">
            About
          </b-button>
          <b-button variant="outline-primary" v-bind:to="{path: 'projects'}">
            Projects
          </b-button>
          <b-button variant="outline-primary" v-bind:to="{path: 'courses'}">
            Courses
          </b-button>
          <b-button variant="outline-primary" v-bind:to="{path: 'contact'}">
            Contact
          </b-button>
        </div>
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
  padding: 0;
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
  padding-bottom: 15px;
  font-family: monaco, monospace;
}
</style>

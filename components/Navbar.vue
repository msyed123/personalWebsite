<template>
  <b-navbar type="dark" variant="primary" v-bind:sticky="true">
    <b-navbar-nav>
      <b-nav-item>
        <nuxt-link to="/" exact class="nuxt-link">Home</nuxt-link>
      </b-nav-item>
      <b-nav-item>
        <nuxt-link to="/about" exact class="nuxt-link">About</nuxt-link>
      </b-nav-item>
            <b-nav-item>
        <nuxt-link to="/projects" exact class="nuxt-link">Projects</nuxt-link>
      </b-nav-item>
      
    </b-navbar-nav>

  </b-navbar>
</template>

<script>
import VueNextLevelScroll from "vue-next-level-scroll";

export default {
  components: {
    VueNextLevelScroll
  },
  data() {
    return {
      isVisible: false,
      navItems: [
        {
          name: "About",
          anchor: "about"
        },
        {
          name: "Skills",
          anchor: "skills"
        },
        {
          name: "Timeline",
          anchor: "timeline"
        }
      ]
    };
  },
  computed: {
    showNavLinks() {
      return this.$route.path === "/";
    }
  },
  methods: {
    toggleVisibility() {
      this.isVisible = !this.isVisible;
    }
  }
};
</script>

<style>
.nuxt-link {
  font-family: monaco, monospace;
  font-size: 22px;
  color: white;
}
.nuxt-link-active {
  color: white;
  text-decoration: underline;
  text-decoration-style: dashed;
  font-weight: bold;
}
.nuxt-link:hover {
  color: white;
  text-decoration: none;
  font-weight: bold;
}

.navbar {
  min-height: 20px;
}

.navbar-brand {
  padding: 0 15px;
  height: 20px;
  line-height: 20px;
}

.navbar-toggle {
  /* (80px - button height 34px) / 2 = 23px */
  margin-top: 1px;
  padding: 9px 10px !important;
}

@media (min-width: 768px) {
  .navbar-nav > li > a {
    /* (80px - line-height of 27px) / 2 = 26.5px */
    padding-top: 2.5px;
    padding-bottom: 2.5px;
    line-height: 15px;
  }
}

</style>

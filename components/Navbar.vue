<template>
  <b-navbar toggleable="lg" type="dark" variant="primary">
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

    <!-- Right aligned nav items -->
    <b-navbar-nav class="ml-auto">
      <b-nav-form>
        <b-form-input size="sm" class="mr-sm-2" placeholder="Search"></b-form-input>
        <b-button size="sm" class="my-2 my-sm-0" type="submit">Search</b-button>
      </b-nav-form>

      <b-nav-item-dropdown right>
        <!-- Using 'button-content' slot -->
        <template slot="button-content"><em>User</em></template>
        <b-dropdown-item href="#">Profile</b-dropdown-item>
        <b-dropdown-item href="#">Sign Out</b-dropdown-item>
      </b-nav-item-dropdown>
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
</style>

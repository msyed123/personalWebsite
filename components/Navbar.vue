<template>
    <b-navbar toggleable="lg" type="dark" variant="custom" class="custom-navbar">
      <b-navbar-brand path="/">Mamoon Syed</b-navbar-brand>
      <b-navbar-toggle target="nav-collapse"></b-navbar-toggle>
  
      <b-collapse id="nav-collapse" is-nav>
        <b-navbar-nav>
          <b-nav-item v-for="item in menuOptionsLeft" :key="item.text" :to="item.path">
            {{ item.text }}
          </b-nav-item>
  
          <!-- If you want to add dropdowns in the future, you can use b-nav-item-dropdown -->
          <!-- Example of a dropdown menu -->
          <!--
          <b-nav-item-dropdown text="More">
            <b-dropdown-item href="#">Option 1</b-dropdown-item>
            <b-dropdown-item href="#">Option 2</b-dropdown-item>
            <b-dropdown-divider></b-dropdown-divider>
            <b-dropdown-item href="#">Separated link</b-dropdown-item>
          </b-nav-item-dropdown>
          -->
        </b-navbar-nav>
      </b-collapse>
    </b-navbar>
  </template>
  
  <script>
  export default {
    data() {
      return {
        menuOptionsLeft: [
          { text: 'Home', path: '/' },
          { text: 'About', path: { name: 'about' } },
          { text: 'Projects', path: { name: 'projects' } },
          { text: 'Courses', path: { name: 'courses' } },
          { text: 'Contact', path: { name: 'contact' } },
        ]
      };
    }
  };
  </script>
  
  <style scoped>
  /* More specific selectors */
    .custom-navbar {
    background: linear-gradient(45deg, #2e1fff, #a8a8a8) !important; 
    border-bottom: 3px solid #2e1fff !important; 
    }

    .b-navbar-brand {
    font-family: 'Montserrat', sans-serif !important;
    font-weight: 700 !important;
    color: #ff4081 !important; 
    }

    .b-navbar-nav .nav-link {
    color: #ffffff !important; 
    font-family: 'Roboto', sans-serif !important;
    font-weight: 500 !important;
    padding: 0.75rem 1rem !important;
    transition: all 0.3s ease !important;
    }

    .b-navbar-nav .nav-link:hover {
    color: #ff4081 !important; 
    background-color: #444 !important; 
    border-radius: 5px !important;
    }

    .b-navbar-nav .nav-link.active {
    color: #ff4081 !important; 
    background-color: #444 !important; 
    border-radius: 5px !important;
    }
  </style>
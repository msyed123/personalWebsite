<template>
    <b-navbar toggleable="lg" type="dark" variant="custom" class="custom-navbar shadow-sm">
      <b-navbar-brand to="/">Mamoon Syed</b-navbar-brand>
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
  /* Navbar styling and spacing */
  .custom-navbar {
    background: linear-gradient(90deg, #4f46e5, #7c3aed) !important; /* indigo -> purple */
    border-bottom: 0 !important;
    padding: 0.5rem 1rem !important; /* vertical padding */
    min-height: 58px; /* consistent height */
  }

  /* Brand */
  .navbar-brand {
    font-family: 'Montserrat', sans-serif !important;
    font-weight: 700 !important;
    color: #ffffff !important;
    letter-spacing: 0.2px;
    margin-right: 1rem;
  }

  /* Links */
  .navbar-nav .nav-link {
    color: #f4f4ff !important;
    font-family: 'Roboto', sans-serif !important;
    font-weight: 500 !important;
    padding: 0.5rem 0.75rem !important;
    transition: color .2s ease, background-color .2s ease !important;
    border-radius: 6px;
  }

  .navbar-nav .nav-link:hover {
    color: #ffffff !important;
    background-color: rgba(255,255,255,0.12) !important;
  }

  .navbar-nav .nav-link.active {
    color: #ffffff !important;
    background-color: rgba(255,255,255,0.22) !important;
  }
  
  /* Collapse layout spacing */
  @media (max-width: 991.98px) {
    #nav-collapse { padding-top: .25rem; }
  }
  </style>

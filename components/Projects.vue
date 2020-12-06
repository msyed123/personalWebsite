<template>
    <div>
        <div v-if="loading">
            <b-card
            no-body
            border-variant="primary"
            header-bg-variant="primary"
            header-text-variant="white" 
            class="overflow-hidden"
            header="Loading...">
                <Loading />
            </b-card>
        </div>
        <div v-else>
            <li v-for="project in projects" v-bind:key="project.data.title">
                <b-card 
                no-body
                border-variant="primary"
                header-bg-variant="primary"
                header-text-variant="white" 
                class="overflow-hidden"
                v-bind:header="project.data.project_title[0].text"
                v-bind:footer="project.data.project_dates[0].text"
                >
                    <b-row no-gutters align-v="center" align-h="center">
                        <b-col md="4">
                            <b-card-img
                                v-bind:src="project.data.project_image.url"
                                class="rounded-0"
                            ></b-card-img>
                        </b-col>
                        <b-col md="8">
                            <b-card-body>
                                <b-card-text>
                                    <b>Role: {{project.data.project_role[0].text}}</b>
                                    <li v-for="description in project.data.project_details" v-bind:key="description.text">
                                        {{description.text}}
                                    </li>
                                    <br />
                                </b-card-text>
                            </b-card-body>
                        </b-col>
                    </b-row>
                </b-card>
            </li>
        </div>   
    </div>
</template>

<script>
import Loading from "~/components/Loading.vue";
import Prismic from "prismic-javascript";
import PrismicDom from "prismic-dom";

export default {
    components: {
        Loading
    },
    data() {
        return{
            loading: true,
            projects: []
        };
    }, 

    methods: {
        async getProjects() {
            const api = await Prismic.getApi(process.env.PRISMIC_ENDPOINT, {accessToken: process.env.PRISMIC_TOKEN});
            const response = await api.query(
                Prismic.Predicates.at("document.type", "project"),
                { orderings : '[my.project.priority]'}
            )
            this.projects = response.results;
            this.loading = false;
        }
    },

    created() {
        this.getProjects()
    }
};
</script>

<style>
body{
	font-family: monaco, monospace;
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

.project{
	margin:5px;
	font-size: 16px;
}

.bar{
	width: 100%;
	background:#dfdfdf;
	overflow: hidden;
	padding:5px;
}

.progress{
	float:left;
	padding:15px;
}

.dates{
	float: right;
	font-weight: 600;
	height: 30px;
	line-height: 30px;
}
</style>

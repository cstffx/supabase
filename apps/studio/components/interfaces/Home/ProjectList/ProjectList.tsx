import { groupBy } from 'lodash'
import Link from 'next/link'
import { Button, IconPlus } from 'ui'

import AlertError from 'components/ui/AlertError'
import NoSearchResults from 'components/ui/NoSearchResults'
import { useOrgIntegrationsQuery } from 'data/integrations/integrations-query-org-only'
import {
  OverdueInvoicesResponse,
  useOverdueInvoicesQuery,
} from 'data/invoices/invoices-overdue-query'
import { useOrganizationsQuery } from 'data/organizations/organizations-query'
import { usePermissionsQuery } from 'data/permissions/permissions-query'
import { ProjectInfo, useProjectsQuery } from 'data/projects/projects-query'
import { ResourceWarning, useResourceWarningsQuery } from 'data/usage/resource-warnings-query'
import { useSelectedOrganization } from 'hooks'
import { IS_PLATFORM } from 'lib/constants'
import { makeRandomString } from 'lib/helpers'
import { Organization, ResponseError } from 'types'
import ProjectCard from './ProjectCard'
import ShimmeringCard from './ShimmeringCard'

export interface ProjectListProps {
  rewriteHref?: (projectRef: string) => string
  search: string
}

const ProjectList = ({ search, rewriteHref }: ProjectListProps) => {
  const { data: organizations, isLoading, isSuccess } = useOrganizationsQuery()
  const {
    data: allProjects,
    isLoading: isLoadingProjects,
    isError: isErrorProjects,
    error: projectsError,
  } = useProjectsQuery()
  const {
    isLoading: _isLoadingPermissions,
    isError: isErrorPermissions,
    error: permissionsError,
  } = usePermissionsQuery()
  const { data: resourceWarnings } = useResourceWarningsQuery()
  const { data: allOverdueInvoices } = useOverdueInvoicesQuery({ enabled: IS_PLATFORM })
  const projectsByOrg = groupBy(allProjects, 'organization_id')
  const isLoadingPermissions = IS_PLATFORM ? _isLoadingPermissions : false
  const noResults =
    allProjects !== undefined &&
    allProjects.filter((project) => {
      return (
        project.name.toLowerCase().includes(search.toLowerCase()) ||
        project.ref.includes(search.toLowerCase())
      )
    }).length === 0

  if (isLoading) {
    return (
      <ul className="mx-auto grid grid-cols-1 gap-4 sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        <ShimmeringCard />
        <ShimmeringCard />
      </ul>
    )
  }

  if (noResults) {
    return <NoSearchResults searchString={search} />
  }

  return isSuccess && organizations && organizations?.length > 0 ? (
    <>
      {organizations?.map((organization) => {
        return (
          <OrganizationProjects
            key={organization.id}
            organization={organization}
            projects={projectsByOrg[organization.id]}
            overdueInvoices={(allOverdueInvoices ?? []).filter(
              (it) => it.organization_id === organization.id
            )}
            resourceWarnings={resourceWarnings ?? []}
            rewriteHref={rewriteHref}
            isLoadingPermissions={isLoadingPermissions}
            isErrorPermissions={isErrorPermissions}
            permissionsError={permissionsError}
            isLoadingProjects={isLoadingProjects}
            isErrorProjects={isErrorProjects}
            projectsError={projectsError}
            search={search}
          />
        )
      })}
    </>
  ) : (
    <NoProjectsState slug={''} />
  )
}

export default ProjectList

type OrganizationProjectsProps = {
  organization: Organization
  projects: ProjectInfo[]
  overdueInvoices: OverdueInvoicesResponse[]
  resourceWarnings: ResourceWarning[]
  isLoadingPermissions: boolean
  isErrorPermissions: boolean
  permissionsError: ResponseError | null
  isLoadingProjects: boolean
  isErrorProjects: boolean
  projectsError: ResponseError | null
  rewriteHref?: (projectRef: string) => string
  search: string
}

const OrganizationProjects = ({
  organization: { name, slug },
  projects,
  overdueInvoices,
  resourceWarnings,
  isLoadingPermissions,
  isErrorPermissions,
  permissionsError,
  isLoadingProjects,
  isErrorProjects,
  projectsError,
  rewriteHref,
  search,
}: OrganizationProjectsProps) => {
  const organization = useSelectedOrganization()
  const isEmpty = !projects || projects.length === 0
  const sortedProjects = [...(projects || [])].sort((a, b) => a.name.localeCompare(b.name))
  const filteredProjects =
    search.length > 0
      ? sortedProjects.filter((project) => {
          return (
            project.name.toLowerCase().includes(search.toLowerCase()) ||
            project.ref.includes(search.toLowerCase())
          )
        })
      : sortedProjects

  const { data: integrations } = useOrgIntegrationsQuery({ orgSlug: organization?.slug })
  const githubConnections = integrations
    ?.filter((integration) => integration.integration.name === 'GitHub')
    .flatMap((integration) => integration.connections)
  const vercelConnections = integrations
    ?.filter((integration) => integration.integration.name === 'Vercel')
    .flatMap((integration) => integration.connections)

  if (search.length > 0 && filteredProjects.length === 0) return null

  return (
    <div className="space-y-3" key={makeRandomString(5)}>
      <div className="flex space-x-4 items-center">
        <h4 className="text-lg flex items-center">{name}</h4>

        {!!overdueInvoices.length && (
          <div>
            <Button asChild type="danger">
              <Link href={`/org/${slug}/invoices`}>Outstanding Invoices</Link>
            </Button>
          </div>
        )}
      </div>

      {isLoadingPermissions || isLoadingProjects ? (
        <ul className="mx-auto grid grid-cols-1 gap-4 sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          <ShimmeringCard />
          <ShimmeringCard />
        </ul>
      ) : (
        <ul className="mx-auto grid grid-cols-1 gap-4 sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {isErrorPermissions ? (
            <div className="col-span-3">
              <AlertError
                subject="Failed to retrieve permissions for your account"
                error={permissionsError}
              />
            </div>
          ) : isErrorProjects ? (
            <div className="col-span-3">
              <AlertError
                subject={`Failed to retrieve projects under ${name}`}
                error={projectsError}
              />
            </div>
          ) : isEmpty ? (
            <NoProjectsState slug={slug} />
          ) : (
            filteredProjects?.map((project) => (
              <ProjectCard
                key={makeRandomString(5)}
                project={project}
                rewriteHref={rewriteHref ? rewriteHref(project.ref) : undefined}
                resourceWarnings={resourceWarnings.find(
                  (resourceWarning) => resourceWarning.project === project.ref
                )}
                githubIntegration={githubConnections?.find(
                  (connection) => connection.supabase_project_ref === project.ref
                )}
                vercelIntegration={vercelConnections?.find(
                  (connection) => connection.supabase_project_ref === project.ref
                )}
              />
            ))
          )}
        </ul>
      )}
    </div>
  )
}

const NoProjectsState = ({ slug }: { slug: string }) => {
  return (
    <div className="col-span-4 space-y-4 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
      <div className="space-y-1">
        <p>No projects</p>
        <p className="text-sm text-foreground-light">Get started by creating a new project.</p>
      </div>
      <div>
        <Button asChild icon={<IconPlus />}>
          <Link href={`/new/${slug}`}>New Project</Link>
        </Button>
      </div>
    </div>
  )
}

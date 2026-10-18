package com.apa.ats.user;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<AtsUser, Long> {

    Optional<AtsUser> findByUsernameIgnoreCase(String username);

    boolean existsByUsernameIgnoreCase(String username);

    @Query("select u from AtsUser u left join fetch u.roles where u.id = :id")
    Optional<AtsUser> findWithRolesById(@Param("id") Long id);

    /** id, full name, organization, avatar colour, active: no roles, for the reference cache. */
    @Query("select u.id, u.fullName, u.organization, u.avatarColor, u.active from AtsUser u")
    List<Object[]> referenceRows();

    @Query("select count(u) > 0 from AtsUser u where lower(u.email) = lower(?1) and (?2 is null or u.id <> ?2)")
    boolean emailTaken(String email, Long exceptId);

    @Query("select distinct u from AtsUser u left join fetch u.roles order by u.fullName")
    List<AtsUser> findAllWithRoles();

    /** Active users of one organization (the new-ticket email goes to the VENDOR ones). */
    List<AtsUser> findByOrganizationAndActiveTrue(AtsUser.Organization organization);

    @Query("select count(distinct u) from AtsUser u join u.roles r where r.code = ?1 and u.active = true")
    long countActiveWithRole(String roleCode);
}
